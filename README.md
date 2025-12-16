# CTBooking - Environment Configuration

## Cloudinary
- Required variables:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
- Add them to `.env` locally:
  - One per line, no trailing spaces
- Production:
  - Store as secrets (Wrangler `secrets put`) rather than committing

## Upload Flow
- Admin tab `Uploads` supports video upload with:
  - File type validation (`video/*`)
  - Confirmation dialog
  - Progress bar
  - Result toast with `public_id` and `secure_url`
- Server uploads to Cloudinary with:
  - Quality auto
  - Resize 1280x720
  - FPS 30
  - Codec H.264
  - MP4 format

## Testing
- Run typecheck: `npm run typecheck`
- Run tests: `npm run test`
- Test covers Cloudinary env reading in `server/cloudinary.spec.ts`
