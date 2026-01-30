# Plan: Instagram Story Export for Pick'em

> **Goal**: Generate a high-resolution export image in Instagram Story format (9:16, 1080x1920px) containing the full bracket prediction, without altering the existing responsive website layout.

## 1. Analysis
- **Current State**: Export uses `html2canvas` on the visual container. The web layout is now 3 columns on desktop and 1 column on mobile.
- **Requirement**: The export *must* be 1080x1920 (Portrait).
- **Challenge**: The horizontal/grid layout of the web view will likely look small or cropped if forced directly into 9:16.
- **Solution**: We need a "Transform Strategy". When the user clicks download:
    1.  Clone the container or apply a specific `.capture-story-mode` class.
    2.  Force the layout into a strictly vertical stack (Header -> Group A -> Group B -> Semi -> Final -> Champion -> Footer).
    3.  Set specific dimensions (1080px width, min-height 1920px).
    4.  Scale fonts and padding to fill the space aesthetically.
    5.  Capture, then revert (or discard clone).

## 2. User Review Required
> [!IMPORTANT]
> **Layout Change for Image Only**: The generated image will look different from the website. It will be a tall, vertical list to fit the phone screen format perfectly.
>
> **Questions to Confirm**:
> 1. Do you want a specific background image for the story, or keep the dark blue theme? (Assuming Dark Blue for now).
KEEP IT!
> 2. Should we include the "Rules/Point System" text in the image, or just the picks? (Assuming Just Picks to save space).
Just the picks + Name + hash + qr hash + date + logo hastma cup

## 3. Proposed Changes

### Frontend (HTML/CSS)
#### [MODIFY] [pickem.html](file:///e:/Hastma%20cup%202026/website/pickem.html)
- Add CSS rules for `.capture-story-mode`:
    - `width: 1080px !important;`
    - `height: 1920px !important;`
    - `display: flex; flex-direction: column;`
    - Scale up fonts for 1080px width (e.g., team names 2rem+).
    - Grid containers forced to `display: flex; flex-direction: column;`.

### Logic (JS)
#### [MODIFY] [js/pickem.js](file:///e:/Hastma%20cup%202026/website/js/pickem.js)
- Update `downloadCard()` function:
    - Instead of just capturing `#captureArea`, we might need to clone it to a hidden overlay to manipulate it safely without flickering the screen.
    - Or, continue using the "Temporary Class" method but refine the CSS to be strict 1080x1920.
    - Ensure `html2canvas` uses `windowWidth: 1080`, `windowHeight: 1920`.

## 4. Verification Plan
### Automated/Manual Tests
- [ ] **Deskop Test**: Click "Download". Verify the website layout does *not* shift visible. Verify downloaded image is 1080x1920.
- [ ] **Mobile Test**: Same as desktop.
- [ ] **Visual Check**: Open image on Phone. Ensure text is readable and not tiny.

## 5. Timeline
- **Phase 1**: CSS Styling for Story Mode.
- **Phase 2**: JS Logic Update (Clone & Capture).
- **Phase 3**: Verification.
