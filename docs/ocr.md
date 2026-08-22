# OCR & Gemini AI Pipeline

## Processing Flow
$$\text{Uploaded Image} \longrightarrow \text{Image Validation \& Compression} \longrightarrow \text{Google Vision OCR} \longrightarrow \text{Gemini Structuring} \longrightarrow \text{Human Staff Verification} \longrightarrow \text{Database Insertion}$$

## Key Features
1. **Image Validation & Compression**:
   - Accepts scanned paper records (PNG, JPEG, WebP, PDF).
   - Validates file headers and size.
   - If image > 2MB, compresses using `sharp` targeting $\le 2\text{ MB}$ without destroying text readability. Small images (< 500KB) are left unexpanded.
2. **Provider Abstraction**:
   - `IOcrEngine` interface wraps Google Cloud Vision API with fallback capabilities.
3. **Gemini AI Role**:
   - Parses raw OCR text into candidate JSON fields (`fullName`, `partnerName`, `visitDate`, `deDate`, `freezingDate`, `comments`).
   - **Gemini is NOT a medical authority**: AI output is strictly candidate data.
4. **Mandatory Human Verification**:
   - Staff must view original scanned document on left side of screen alongside pre-filled candidate fields on right side.
   - Staff can edit, correct, approve, or reject before saving.
