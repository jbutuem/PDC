-- 20260831153000_0008_papel_imagem_produto.sql
-- O admin usa 'produto'; a migração 0001 criou 'regular'. Acrescenta o valor.
alter type papel_imagem add value if not exists 'produto';
