# 03 — Banco de Dados (Supabase / Postgres)

Execute o script abaixo **inteiro** no *SQL Editor* do Supabase.

## Modelo
```
campeonato 1─N times 1─N jogadores
campeonato 1─N rodadas 1─N jogos N─1 times (mandante / visitante)
jogos 1─N gols N─1 jogadores
```

## Script
```sql
-- =========================================================
-- TABELAS
-- =========================================================
create table campeonato (
  id            bigint generated always as identity primary key,
  nome          text not null,
  local         text,
  organizacao   text,
  ano           int  default extract(year from now()),
  criado_em     timestamptz default now()
);

create table times (
  id             bigint generated always as identity primary key,
  campeonato_id  bigint not null references campeonato(id) on delete cascade,
  nome           text not null,
  sigla          text,
  escudo_url     text,
  ativo          boolean not null default true,
  criado_em      timestamptz default now(),
  unique (campeonato_id, nome)
);

create table jogadores (
  id         bigint generated always as identity primary key,
  time_id    bigint not null references times(id) on delete cascade,
  nome       text not null,
  criado_em  timestamptz default now()
);
create unique index jogadores_time_nome_uk on jogadores (time_id, lower(trim(nome)));

create table rodadas (
  id             bigint generated always as identity primary key,
  campeonato_id  bigint not null references campeonato(id) on delete cascade,
  numero         int not null,
  data           date,
  observacao     text,
  unique (campeonato_id, numero)
);

create table jogos (
  id              bigint generated always as identity primary key,
  rodada_id       bigint not null references rodadas(id) on delete cascade,
  mandante_id     bigint not null references times(id),
  visitante_id    bigint not null references times(id),
  data_hora       timestamptz,
  gols_mandante   int check (gols_mandante  >= 0),
  gols_visitante  int check (gols_visitante >= 0),
  status          text not null default 'agendado'
                  check (status in ('agendado','ao_vivo','encerrado','adiado','wo')),
  atualizado_em   timestamptz default now(),
  check (mandante_id <> visitante_id)
);

create table gols (
  id          bigint generated always as identity primary key,
  jogo_id     bigint not null references jogos(id) on delete cascade,
  time_id     bigint not null references times(id),   -- time que RECEBE o gol no placar
  jogador_id  bigint references jogadores(id),         -- autor (null permitido em gol contra sem nome)
  quantidade  int not null default 1 check (quantidade > 0),
  contra      boolean not null default false           -- gol contra: conta no placar, não na artilharia
);

create index on jogos (rodada_id);
create index on gols (jogo_id);
create index on gols (jogador_id);

-- =========================================================
-- VIEW: CLASSIFICAÇÃO (critérios 1–4; confronto direto no front)
-- =========================================================
create or replace view v_classificacao with (security_invoker = true) as
with partidas as (
  select j.mandante_id  as time_id, j.gols_mandante  as gp, j.gols_visitante as gc from jogos j where j.status = 'encerrado'
  union all
  select j.visitante_id as time_id, j.gols_visitante as gp, j.gols_mandante  as gc from jogos j where j.status = 'encerrado'
)
select
  t.id as time_id, t.campeonato_id, t.nome, t.sigla, t.escudo_url,
  count(p.time_id)                                        as j,
  count(*) filter (where p.gp >  p.gc)                    as v,
  count(*) filter (where p.gp =  p.gc)                    as e,
  count(*) filter (where p.gp <  p.gc)                    as d,
  coalesce(sum(p.gp),0)                                   as gp,
  coalesce(sum(p.gc),0)                                   as gc,
  coalesce(sum(p.gp),0) - coalesce(sum(p.gc),0)           as sg,
  3 * count(*) filter (where p.gp > p.gc)
    + count(*) filter (where p.gp = p.gc)                 as pts,
  case when count(p.time_id) = 0 then 0
       else round(100.0 * (3 * count(*) filter (where p.gp > p.gc) + count(*) filter (where p.gp = p.gc))
                  / (3 * count(p.time_id)), 1) end        as aproveitamento
from times t
left join partidas p on p.time_id = t.id
where t.ativo
group by t.id
order by pts desc, v desc, sg desc, gp desc, t.nome;

-- =========================================================
-- VIEW: ARTILHARIA
-- =========================================================
create or replace view v_artilharia with (security_invoker = true) as
select
  jg.id as jogador_id, jg.nome as jogador,
  t.id  as time_id, t.nome as time, t.escudo_url, t.campeonato_id,
  sum(g.quantidade) as gols
from gols g
join jogos jo     on jo.id = g.jogo_id and jo.status = 'encerrado'
join jogadores jg on jg.id = g.jogador_id
join times t      on t.id  = jg.time_id
where not g.contra
group by jg.id, t.id
order by gols desc, jg.nome;

-- =========================================================
-- FUNÇÃO: SALVAR RESULTADO (atômica)
-- p_gols = [{"time_id":1,"jogador_nome":"Pedro","quantidade":2,"contra":false}, ...]
--   time_id = time que recebe o gol no placar.
--   Em gol contra, jogador_nome é opcional e pertence ao ADVERSÁRIO (não pontua na artilharia).
-- =========================================================
create or replace function salvar_resultado(
  p_jogo_id bigint, p_gols_mandante int, p_gols_visitante int, p_gols jsonb
) returns void
language plpgsql security invoker as $$
declare
  v_jogo jogos%rowtype;
  v_item jsonb;
  v_time_autor bigint;
  v_jogador_id bigint;
  v_nome text;
  v_soma_m int := 0;
  v_soma_v int := 0;
begin
  if auth.uid() is null then
    raise exception 'Somente o organizador pode lançar resultados.';
  end if;

  select * into v_jogo from jogos where id = p_jogo_id for update;
  if not found then raise exception 'Jogo % não encontrado.', p_jogo_id; end if;

  -- valida soma
  select coalesce(sum((x->>'quantidade')::int) filter (where (x->>'time_id')::bigint = v_jogo.mandante_id),0),
         coalesce(sum((x->>'quantidade')::int) filter (where (x->>'time_id')::bigint = v_jogo.visitante_id),0)
    into v_soma_m, v_soma_v
  from jsonb_array_elements(coalesce(p_gols,'[]'::jsonb)) x;

  if v_soma_m <> p_gols_mandante or v_soma_v <> p_gols_visitante then
    raise exception 'Soma dos gols (% x %) não confere com o placar (% x %).',
      v_soma_m, v_soma_v, p_gols_mandante, p_gols_visitante;
  end if;

  delete from gols where jogo_id = p_jogo_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_gols,'[]'::jsonb)) loop
    v_nome := nullif(trim(v_item->>'jogador_nome'), '');
    v_jogador_id := null;

    if v_nome is not null then
      -- autor do gol: mesmo time, ou adversário se for gol contra
      v_time_autor := case
        when coalesce((v_item->>'contra')::boolean,false) then
          case when (v_item->>'time_id')::bigint = v_jogo.mandante_id then v_jogo.visitante_id else v_jogo.mandante_id end
        else (v_item->>'time_id')::bigint end;

      insert into jogadores (time_id, nome) values (v_time_autor, v_nome)
      on conflict (time_id, lower(trim(nome))) do nothing;

      select id into v_jogador_id from jogadores
       where time_id = v_time_autor and lower(trim(nome)) = lower(v_nome);
    end if;

    insert into gols (jogo_id, time_id, jogador_id, quantidade, contra)
    values (p_jogo_id, (v_item->>'time_id')::bigint, v_jogador_id,
            (v_item->>'quantidade')::int, coalesce((v_item->>'contra')::boolean,false));
  end loop;

  update jogos set gols_mandante = p_gols_mandante, gols_visitante = p_gols_visitante,
                   status = 'encerrado', atualizado_em = now()
  where id = p_jogo_id;
end $$;

-- =========================================================
-- REGRA: time não pode jogar 2x na mesma rodada
-- =========================================================
create or replace function checar_time_na_rodada() returns trigger language plpgsql as $$
begin
  if exists (select 1 from jogos
             where rodada_id = new.rodada_id and id <> coalesce(new.id, -1)
               and (mandante_id in (new.mandante_id, new.visitante_id)
                 or visitante_id in (new.mandante_id, new.visitante_id))) then
    raise exception 'Um dos times já tem jogo nesta rodada.';
  end if;
  return new;
end $$;
create trigger trg_time_na_rodada before insert or update on jogos
for each row execute function checar_time_na_rodada();

-- =========================================================
-- SEGURANÇA (RLS): leitura pública, escrita só autenticado
-- =========================================================
do $$ declare t text; begin
  foreach t in array array['campeonato','times','jogadores','rodadas','jogos','gols'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "leitura publica" on %I for select to anon, authenticated using (true)', t);
    execute format('create policy "escrita organizador" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- =========================================================
-- REALTIME
-- =========================================================
alter publication supabase_realtime add table jogos, gols, times, rodadas, jogadores;

-- =========================================================
-- STORAGE: escudos
-- =========================================================
insert into storage.buckets (id, name, public) values ('escudos','escudos', true)
on conflict (id) do nothing;
create policy "escudos leitura"  on storage.objects for select to anon, authenticated using (bucket_id = 'escudos');
create policy "escudos upload"   on storage.objects for insert to authenticated with check (bucket_id = 'escudos');
create policy "escudos update"   on storage.objects for update to authenticated using (bucket_id = 'escudos');
create policy "escudos delete"   on storage.objects for delete to authenticated using (bucket_id = 'escudos');

-- =========================================================
-- SEED inicial
-- =========================================================
insert into campeonato (nome, local, organizacao)
values ('1º Campeonato Sanroquense', 'Campo Maicon Santos', 'Pebinha e Duduzete');

insert into times (campeonato_id, nome) values
 (1,'RDL'),(1,'Palmeiras'),(1,'Real Barça SR'),(1,'Juventus'),(1,'Malvina'),
 (1,'Os 10'),(1,'Rua Nova'),(1,'Os Coroas'),(1,'Fúria'),(1,'SR City');
```

## Observações
- **Segurança (obrigatório antes de publicar):** em *Authentication → Sign In / Providers* **desligue "Allow new users to sign up"**. Como a política de escrita vale para qualquer usuário autenticado, o cadastro aberto deixaria qualquer pessoa editar a tabela. Crie os organizadores manualmente em *Authentication → Users*.
- **Placar ao vivo:** status `ao_vivo` guarda o placar parcial em `gols_mandante/gols_visitante`; a classificação e a artilharia só contam jogos `encerrado`.
- **Se houver mais de um organizador**, todos usam contas no Supabase Auth; qualquer autenticado escreve. Para restringir por e-mail, trocar a policy de escrita por `using (auth.jwt()->>'email' in ('a@x.com','b@y.com'))`.
- **Correção de placar:** basta chamar `salvar_resultado` de novo — os gols antigos do jogo são substituídos.
- **Excluir jogo encerrado:** apaga os gols em cascata e a classificação se recalcula.

## pico_online (público no app por dia)
```sql
create table pico_online (dia date primary key, pico integer not null check (pico between 0 and 300), hora timestamptz not null default now());
alter table pico_online enable row level security;
create policy "leitura organizador" on pico_online for select to authenticated using (true);
-- registrar_pico_online(p_total int): security definer, só aumenta o pico do dia (horário da Bahia); execute para anon e authenticated
```
