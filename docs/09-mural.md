# 09 — Mural (fotos, descrição e comentários)

Execute **depois** do script de `03-banco-de-dados.md`, no *SQL Editor* do Supabase.

## Regras do produto
| Quem | Pode |
|---|---|
| **Time** (com o *código do time*) | Publicar foto + descrição (opcionalmente ligada a um jogo) e apagar as **próprias** publicações |
| **Organizador** (login) | Publicar como "Organização", apagar **qualquer** publicação ou comentário, ver/gerar os códigos dos times |
| **Torcedor** (sem login) | Ver o mural e comentar informando o nome |

- Só **foto + descrição + comentário** (sem vídeo, sem curtidas, sem respostas).
- Foto: JPEG, redimensionada no celular para no máx. 1280 px (~200 KB), limite de 3 MB no Storage.
- Descrição até 500 caracteres; comentário até 300; nome até 30.
- O código do time fica numa tabela **só do organizador** (`codigos_times`); nunca é lido pelo público.

## Segurança
- Quem não é organizador **não escreve direto nas tabelas**: usa funções (`publicar_post`, `comentar_post`, `apagar_post_time`) que validam o código/limites.
- Limites anti-spam: 10 publicações/hora por time e 15 comentários/minuto por publicação.
- O bucket `mural` aceita upload anônimo (necessário porque o time não tem login), mas só de JPEG até 3 MB, e a foto só aparece se uma publicação válida apontar para ela. Arquivos órfãos podem sobrar no Storage; se incomodar, o organizador limpa pelo painel do Supabase.
- Se um código vazar, o organizador gera outro no painel (Times → Gerar novo código).

## Script
```sql
-- =========================================================
-- TABELAS
-- =========================================================
create table codigos_times (
  time_id  bigint primary key references times(id) on delete cascade,
  codigo   text not null unique
);

create table posts (
  id             bigint generated always as identity primary key,
  campeonato_id  bigint not null references campeonato(id) on delete cascade,
  time_id        bigint references times(id) on delete set null,   -- null = organização
  autor          text not null,
  descricao      text check (char_length(descricao) <= 500),
  foto_path      text not null,                                    -- caminho no bucket "mural"
  jogo_id        bigint references jogos(id) on delete set null,
  criado_em      timestamptz not null default now()
);
create index on posts (criado_em desc);

create table comentarios (
  id         bigint generated always as identity primary key,
  post_id    bigint not null references posts(id) on delete cascade,
  nome       text not null check (char_length(nome)  between 1 and 30),
  texto      text not null check (char_length(texto) between 1 and 300),
  criado_em  timestamptz not null default now()
);
create index on comentarios (post_id, criado_em);

-- códigos iniciais (6 caracteres) para os times já cadastrados
insert into codigos_times (time_id, codigo)
select id, upper(substr(md5(random()::text || id::text), 1, 6)) from times
on conflict do nothing;

-- =========================================================
-- RLS: leitura pública; escrita direta só do organizador
-- =========================================================
alter table posts enable row level security;
alter table comentarios enable row level security;
alter table codigos_times enable row level security;

create policy "leitura publica" on posts       for select to anon, authenticated using (true);
create policy "escrita organizador" on posts   for all    to authenticated using (true) with check (true);
create policy "leitura publica" on comentarios for select to anon, authenticated using (true);
create policy "escrita organizador" on comentarios for all to authenticated using (true) with check (true);
create policy "somente organizador" on codigos_times for all to authenticated using (true) with check (true);

-- =========================================================
-- FUNÇÕES usadas por times e torcedores (sem login)
-- =========================================================
create or replace function validar_codigo(p_codigo text)
returns table (time_id bigint, nome text)
language sql security definer set search_path = public stable as $$
  select t.id, t.nome
    from codigos_times c join times t on t.id = c.time_id
   where c.codigo = upper(trim(p_codigo)) and t.ativo;
$$;

create or replace function publicar_post(
  p_codigo text, p_descricao text, p_foto_path text, p_jogo_id bigint default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_time bigint; v_nome text;
begin
  select time_id, nome into v_time, v_nome from validar_codigo(p_codigo);
  if v_time is null then raise exception 'Código do time inválido.'; end if;
  if p_foto_path is null or p_foto_path !~ '^posts/[0-9a-f-]+\.jpg$' then raise exception 'Foto inválida.'; end if;
  if char_length(coalesce(p_descricao, '')) > 500 then raise exception 'Descrição muito longa (máx. 500).'; end if;
  if (select count(*) from posts where time_id = v_time and criado_em > now() - interval '1 hour') >= 10 then
    raise exception 'Limite de publicações por hora atingido. Tente mais tarde.';
  end if;

  insert into posts (campeonato_id, time_id, autor, descricao, foto_path, jogo_id)
  select t.campeonato_id, v_time, v_nome, nullif(trim(p_descricao), ''), p_foto_path, p_jogo_id
    from times t where t.id = v_time;
end $$;

create or replace function apagar_post_time(p_codigo text, p_post_id bigint)
returns void
language plpgsql security definer set search_path = public as $$
declare v_time bigint;
begin
  select time_id into v_time from validar_codigo(p_codigo);
  if v_time is null then raise exception 'Código do time inválido.'; end if;
  delete from posts where id = p_post_id and time_id = v_time;
end $$;

create or replace function comentar_post(p_post_id bigint, p_nome text, p_texto text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if char_length(trim(coalesce(p_nome, ''))) not between 1 and 30 then raise exception 'Informe seu nome (até 30 letras).'; end if;
  if char_length(trim(coalesce(p_texto, ''))) not between 1 and 300 then raise exception 'Comentário de 1 a 300 caracteres.'; end if;
  if not exists (select 1 from posts where id = p_post_id) then raise exception 'Publicação não encontrada.'; end if;
  if (select count(*) from comentarios where post_id = p_post_id and criado_em > now() - interval '1 minute') >= 15 then
    raise exception 'Muitos comentários agora. Tente de novo em instantes.';
  end if;
  insert into comentarios (post_id, nome, texto) values (p_post_id, trim(p_nome), trim(p_texto));
end $$;

-- =========================================================
-- REALTIME
-- =========================================================
alter publication supabase_realtime add table posts, comentarios;

-- =========================================================
-- STORAGE: bucket "mural" (JPEG até 3 MB)
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mural', 'mural', true, 3145728, array['image/jpeg'])
on conflict (id) do nothing;

create policy "mural leitura" on storage.objects for select to anon, authenticated using (bucket_id = 'mural');
create policy "mural upload"  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'mural' and (storage.foldername(name))[1] = 'posts');
create policy "mural remover" on storage.objects for delete to authenticated using (bucket_id = 'mural');
```

## Módulos
| Arquivo | Papel |
|---|---|
| `mural.html` + `js/paginas/mural.js` | Feed, publicar, comentar, moderar |
| `js/imagem.js` | Redimensiona/comprime a foto antes de enviar |
| `js/api.js` | `listarPosts`, `validarCodigo`, `publicarPost`, `comentarPost`, `apagarPost*`, `apagarComentario`, `listarCodigos`, `gerarCodigo` |
| `admin.html` (aba Times) | Mostra/gera o código de cada time |

## Fluxo — time publica
1. Mural → **+ Publicar foto** → informa o código (fica salvo no aparelho) → escolhe foto, descrição e, se quiser, o jogo.
2. A foto é reduzida no celular e enviada ao bucket `mural`.
3. `publicar_post` valida o código e cria a publicação; o Realtime atualiza o mural de todos.
