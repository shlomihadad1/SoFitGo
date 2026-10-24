# CMS media uploads: what is needed (not set up)

**Status: blocked.** Nothing in this file has been applied.

The local test environment emulates the database and auth but **not** Supabase Storage. Uploads are therefore not built, and the admin "מדיה" tab says so. Applying anything below creates a production resource and needs the owner's approval.

## What exists today

- `cms_content`, `cms_drafts` and `cms_revisions` store text and JSON only, up to 64 KB per item. No binary files.
- Exercise covers are illustrations generated at build time from the motion figure (`tools/media_build.js`). Tutorial videos are recorded from the build.
- The admin "מדיה" tab is a read-only inventory: what exists, what is missing, where each asset is used, broken references.

## What an upload feature needs

1. **Bucket** `cms-media`, created in the dashboard (Storage → New bucket):
   - Public read: yes. Assets are shown to signed-out users too.
   - File size limit: 2 MB for images, 20 MB for video.
   - Allowed MIME types: `image/webp`, `image/png`, `image/jpeg`, `image/svg+xml` (logos only, see note), `video/mp4`.
2. **Policies on `storage.objects`.** The SQL below was written for review only; it was not tested against hosted Storage. It reuses `public.cms_rank(public.cms_role())` from the CMS migration:
   ```sql
   -- read: everyone (public bucket)
   create policy cms_media_read on storage.objects for select to anon, authenticated using (bucket_id = 'cms-media');
   -- write: editors and above; only under media/<kind>/...
   create policy cms_media_insert on storage.objects for insert to authenticated
     with check (bucket_id = 'cms-media' and public.cms_rank(public.cms_role()) >= 2 and (storage.foldername(name))[1] = 'media');
   create policy cms_media_update on storage.objects for update to authenticated
     using (bucket_id = 'cms-media' and public.cms_rank(public.cms_role()) >= 2);
   -- delete: admins only (deleting can break a published reference; the admin UI must check usage first)
   create policy cms_media_delete on storage.objects for delete to authenticated
     using (bucket_id = 'cms-media' and public.cms_rank(public.cms_role()) >= 3);
   ```
3. **App work, after the bucket exists:**
   - upload through the signed-in user's token (never a service key);
   - a metadata row per asset (new CMS kind `media`: path, type, size, alt text, source, licence);
   - replace and delete only when no published item references the asset;
   - tests against a **staging** project, because the local emulator has no Storage.
4. **SVG note:** SVG can carry scripts. Allow it only for logos, and serve it through `<img>` (where scripts do not run) rather than inline.

## Cost

The Supabase Free plan includes 1 GB of Storage and 2 GB/month of egress (verify on the account). Video quickly uses egress. Keep videos small, or host them externally with an explicit decision. Check the plan's spend cap before enabling.
