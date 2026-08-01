# Phase 14 Provider Application Update

## Changes
- Applicants may apply without a professional profile or prior professional experience.
- Primary expertise, professional title, biography, portfolio, LinkedIn, education and CV are optional.
- A short motivation statement remains required.
- Applicants choose Entry-level, Student/Trainee or Experienced.
- Optional CV upload accepts PDF, DOC and DOCX up to 5 MB.
- CV files use the existing IPS object-storage layer and are not exposed publicly.
- Only administrators and the matching provider account can download a stored CV.
- Admin Service Providers view identifies entry-level applicants and provides a Download CV action.

## Local test
1. Run `npm install`.
2. Run `npm run build`.
3. Run the backend with `npm run dev:server`.
4. Run the frontend with `npm run dev` in a second CMD window.
5. Open `/become-a-provider` and submit once without a CV and once with a PDF/DOC/DOCX CV.
6. Sign in as an administrator and review both applications under Service Providers.
