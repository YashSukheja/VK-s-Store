-- Lets the admin see the photo files, which Supabase needs before it will delete or replace one.
-- Without this, removing a photo deleted its row but left the file behind. Shoppers still can't list files.
create policy "admin sees product image files" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
