# Gemini in Midnight Studio v0.5

The **Art Lab** has two ways to create shots without redesigning Evan.

## Gemini Pro mode: use your existing subscription

1. Open Art Lab and select the scene and target format.
2. Verify **Approved Evan reference** says **REFERENCE SAVED**.
3. Choose **Gemini Pro**.
4. Tap **Copy scene + continuity prompt**.
5. Tap **Download Evan reference** to save the image (if needed).
6. Tap **Open Gemini**, paste the prompt, and attach Evan's approved character image in the Gemini conversation. Request one scene.
7. Save Gemini's resulting image to Photos or Files.
8. Return to Art Lab, tap **Import Gemini result**, select the image, review it, then **Use image in selected scene**.

This is a manual handoff, **not** an automated connection to a Gemini subscription.

## Gemini API mode: direct generation

This mode requires a separately deployed private backend and independent API usage billing. A paid Gemini app subscription does not include the API quota automatically.

1. Open https://aistudio.google.com/apikey and create an API key. Do **not** paste it in the Midnight Studio website or commit it to GitHub.
2. Create a Cloudflare Worker through Cloudflare's dashboard on iPhone. Use the contents of `worker/gemini-image.js`.
3. In the Worker settings, create two **Secret** values:
   - `GEMINI_API_KEY`: the Google AI Studio API key.
   - `STUDIO_ACCESS_TOKEN`: a separate long random token used to restrict access to your Worker.
4. Deploy the Worker and copy its HTTPS `*.workers.dev` URL.
5. Back in Midnight Studio Art Lab, choose **Gemini API**. Enter the Worker URL and the separate studio access token, never your Google API key.
6. Select a scene and format. Tap **Generate with Gemini**.
7. Review the returned image. Tap **Use image in selected scene** to save it to local browser storage and apply it to the animation preview.

### Security and operating limits

- GitHub Pages is static hosting and cannot securely hold API secrets by itself.
- The Cloudflare Worker allows requests from `https://mlisrandom.github.io` and requires a secret token. Browser origin checks alone are *not* strong authentication.
- The user-entered studio access token is kept in sessionStorage on the device, **not** in GitHub. Anyone with access to the same browser session can access it. The Worker secret can be rotated.
- This is a one-person prototype; for public traffic, add real account authentication, per-user rate limiting, hard request quotas, expense alerts, and image storage policies. Cloudflare and Google may charge for usage.
- Gemini 3.1 Flash Image is the default model. Depending on account permissions and availability, the Google API may reject it; switch to Gemini 2.5 Flash Image if supported.
- The resulting artwork and character reference are saved locally in the browser's IndexedDB (separate from project JSON). Download original images before clearing Safari data or moving devices.
- Gemini can still drift visually across images. Keeping an approved reference attached to *every* request improves consistency but does not guarantee identical pixels.
- The standalone procedural **Create cartoon frame** button remains available without an API.

Official docs: https://ai.google.dev/gemini-api/docs/image-generation and https://ai.google.dev/gemini-api/docs/pricing
