# PDF Annotator

A modern web application for annotating PDF documents with highlighting, underlining, comments, and signatures.

## Features

-  Upload and view PDF documents
-  Highlight text with various colors
-  Underline text with various colors
-  Add comments to specific locations
-  Draw and add signatures
-  Responsive design for both desktop and mobile
-  Export annotated PDFs with your changes

## Setup and Running Instructions

### Prerequisites

- Node.js (v16 or later)
- npm or yarn

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/DrApkFile/Ritease-PdfAnnotator-Assesment/.git
   cd Ritease-PdfAnnotator-Assesment
   ```

2. Install dependencies
   ```bash
   npm install
   # or
   yarn install
   ```

3. Run the development server
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Libraries and Tools Used

- **Next.js**: React framework for server-rendered applications
- **React PDF**: For rendering PDF documents in the browser
- **PDF-lib**: For programmatically creating and modifying PDFs
- **Tailwind CSS**: For styling the application with utility classes
- **Shadcn/UI**: For pre-built UI components
- **Lucide React**: For beautiful icon components
- **TypeScript**: For type safety and better developer experience

## Implementation Details

### PDF Rendering

The application uses `react-pdf` for rendering PDF documents in the browser. PDF.js is used under the hood to handle the rendering.

### Annotation Layer

A custom annotation layer is implemented to handle:
- Text selection for highlighting and underlining
- Positioning of comments and signatures
- Dragging and repositioning annotations

### Text Selection and Highlighting

The text selection process is handled by:
1. Capturing the user's selection using the browser's Selection API
2. Getting the client rects of the selected range
3. Calculating the position relative to the PDF canvas
4. Creating highlight or underline annotations at the calculated positions

## Challenges Faced and Solutions

### PDF.js Worker File Configuration

**Challenge**: Ensuring the PDF.js worker file was correctly loaded in the application, especially in different environments.

**Solution**: Set up the worker file source explicitly in the code, pointing to an unpkg CDN version:

```typescript
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs`
```

### Text Selection and Highlighting Accuracy

**Challenge**: Making text selection and highlighting work accurately across the entire PDF page instead of only specific regions.

**Solution**:
1. Improved the coordinate calculation by referencing the PDF canvas element directly:
   ```typescript
   const getCorrectedTextCoordinates = (rect: DOMRect) => {
     const canvas = document.querySelector('.react-pdf__Page__canvas');
     // ... calculation logic
   };
   ```

2. Enhanced the text layer CSS to ensure proper positioning and interaction:
   ```css
   .react-pdf__Page__textContent {
     position: absolute !important;
     top: 0 !important;
     left: 0 !important;
     width: 100% !important;
     height: 100% !important;
     /* ... other styles */
   }
   ```

3. Added explicit handling for individual text spans to make them selectable:
   ```typescript
   textSpans.forEach(span => {
     (span as HTMLElement).style.cursor = 'text';
     (span as HTMLElement).style.userSelect = 'text';
     (span as HTMLElement).style.pointerEvents = 'auto';
     // ... other styles
   });
   ```

4. Processed each selection rectangle individually instead of merging them, which allows for more accurate word-level selection.

## Future Enhancements

If given more time, the following features would be added:

1. **PDF Search**: Implement text search functionality within the document
2. **Annotation Export/Import**: Allow saving annotations separately from the PDF for easier collaboration
3. **Annotation History**: Add undo/redo functionality for annotations
4. **Text Extraction**: Allow copying text from the PDF
5. **Form Filling**: Support for filling out PDF forms
6. **Cloud Storage Integration**: Save annotated PDFs to cloud storage services
7. **Real-time Collaboration**: Allow multiple users to annotate the same PDF in real-time
8. **Improved Text Selection**: Further optimize the text selection to handle complex PDF layouts
9. **Offline Support**: Implement PWA features for offline usage
10. **Accessibility Improvements**: Enhance keyboard navigation and screen reader support

