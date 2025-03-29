"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import { PDFDocument } from "pdf-lib"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Upload,
  Highlighter,
  Underline,
  MessageSquare,
  Pen,
  Download,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import SignatureCanvas from "./components/signature-canvas"
import AnnotationLayer from "./components/annotation-layer"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// Set up the PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs`

export default function PDFAnnotator() {
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [activeTab, setActiveTab] = useState<string>("highlight")
  const [activeColor, setActiveColor] = useState<string>("#4285F4") // Microsoft Word blue highlight color
  const [annotations, setAnnotations] = useState<any[]>([])
  const [isDrawingSignature, setIsDrawingSignature] = useState<boolean>(false)
  const [isAddingComment, setIsAddingComment] = useState<boolean>(false)
  const [commentText, setCommentText] = useState<string>("")
  const [commentPosition, setCommentPosition] = useState<{ x: number; y: number } | null>(null)
  const [hasDrawnSignature, setHasDrawnSignature] = useState<boolean>(false)
  const [selectedCommentId, setSelectedCommentId] = useState<number | null>(null)
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const documentRef = useRef<HTMLDivElement>(null)
  const signatureCanvasRef = useRef<any>(null)

  const handleFileChange = (file: File) => {
    setPdfFile(file)
    setCurrentPage(1)
    setAnnotations([])
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (file.type === "application/pdf") {
        handleFileChange(file)
      }
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  const handlePageChange = (delta: number) => {
    const newPage = currentPage + delta
    if (newPage >= 1 && newPage <= numPages) {
      setCurrentPage(newPage)
    }
  }

  const handleZoom = (delta: number) => {
    const newScale = Math.max(0.5, Math.min(2.5, scale + delta))
    setScale(newScale)
  }

  const handleDocumentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!documentRef.current) return

    const rect = documentRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

    if (activeTab === "comment" && !isAddingComment) {
      setCommentPosition({ x, y })
      setIsAddingComment(true)
    } else if (activeTab === "signature" && !isDrawingSignature) {
      setIsDrawingSignature(true)
      // Store the click position to use when the signature is added
      setCommentPosition({ x, y }) // Reuse the commentPosition state for signature position
    }
  }

  const addAnnotation = (type: string, data: any) => {
    const newAnnotation = {
      id: Date.now(),
      type,
      page: currentPage,
      ...data,
    }

    setAnnotations([...annotations, newAnnotation])
  }

  const addComment = () => {
    if (commentText && commentPosition) {
      addAnnotation("comment", {
        text: commentText,
        position: commentPosition,
        color: "#000000", // Always black for comments
      })
      setCommentText("")
      setCommentPosition(null)
      setIsAddingComment(false)
    }
  }

  const addSignature = (signatureData: string) => {
    if (signatureData && hasDrawnSignature) {
      // Use the stored click position if available
      const position = commentPosition || { x: 100, y: 100 }

      addAnnotation("signature", {
        imageData: signatureData,
        position: position,
        width: 200,
        height: 100,
      })
      setIsDrawingSignature(false)
      setCommentPosition(null) // Clear the position after use
      setHasDrawnSignature(false)
    } else {
      alert("Please draw your signature before adding it")
    }
  }

  const removeAnnotation = (id: number) => {
    setAnnotations(annotations.filter((anno) => anno.id !== id))
  }

  const updateAnnotationPosition = (id: number, newPosition: { x: number; y: number }) => {
    setAnnotations(
      annotations.map((anno) => {
        if (anno.id === id) {
          return {
            ...anno,
            position: newPosition,
          }
        }
        return anno
      }),
    )
  }

  // Track signature drawing
  useEffect(() => {
    const checkForDrawing = () => {
      if (signatureCanvasRef.current) {
        const canvas = signatureCanvasRef.current.getCanvas()
        if (canvas) {
          const ctx = canvas.getContext("2d")
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data

          // Check if any pixel is non-white (indicating drawing)
          for (let i = 0; i < imageData.length; i += 4) {
            if (imageData[i] !== 255 || imageData[i + 1] !== 255 || imageData[i + 2] !== 255) {
              setHasDrawnSignature(true)
              return
            }
          }
          setHasDrawnSignature(false)
        }
      }
    }

    if (isDrawingSignature) {
      const interval = setInterval(checkForDrawing, 500)
      return () => clearInterval(interval)
    }
  }, [isDrawingSignature])

  const clearPdf = () => {
    setPdfFile(null)
    setNumPages(0)
    setCurrentPage(1)
    setAnnotations([])
  }

  const viewComment = (id: number) => {
    const comment = annotations.find((anno) => anno.id === id && anno.type === "comment")
    if (comment) {
      setSelectedCommentId(id)
      setIsCommentDialogOpen(true)
    }
  }

  const exportPDF = async () => {
    if (!pdfFile) return

    try {
      const fileReader = new FileReader()

      fileReader.onload = async () => {
        const pdfBytes = new Uint8Array(fileReader.result as ArrayBuffer)

        const pdfDoc = await PDFDocument.load(pdfBytes)
        const pages = pdfDoc.getPages()

        // Iterate through annotations and add them to the PDF
        for (const annotation of annotations) {
          if (annotation.page <= pages.length) {
            const page = pages[annotation.page - 1]

            if (annotation.type === "highlight") {
              // Get the correct color based on the annotation color
              let color;
              if (annotation.color === "#4285F4") {
                color = withOpacity(hexToRgb(annotation.color), 0.3);
              } else if (annotation.color === "#FBC02D") {
                color = withOpacity(hexToRgb(annotation.color), 0.3);
              } else if (annotation.color === "#34A853") {
                color = withOpacity(hexToRgb(annotation.color), 0.3);
              } else if (annotation.color === "#EA4335") {
                color = withOpacity(hexToRgb(annotation.color), 0.3);
              } else if (annotation.color === "#673AB7") {
                color = withOpacity(hexToRgb(annotation.color), 0.3);
              } else {
                color = withOpacity(hexToRgb(annotation.color), 0.3);
              }
              
              // Draw the highlight with clean edges
              page.drawRectangle({
                x: annotation.position.x,
                y: page.getHeight() - annotation.position.y - annotation.position.height,
                width: annotation.position.width,
                height: annotation.position.height,
                color: color,
                borderWidth: 0, // No border for cleaner look
              });
            } else if (annotation.type === "underline") {
              // Get the correct color based on the annotation color
              let color = withOpacity(hexToRgb(annotation.color), 1); // Full opacity for underlines
              
              // Draw an underline with MS Word-like styling
              page.drawLine({
                start: { x: annotation.position.x, y: page.getHeight() - annotation.position.y - annotation.position.height },
                end: { x: annotation.position.x + annotation.position.width, y: page.getHeight() - annotation.position.y - annotation.position.height },
                thickness: 1.5, // Thicker line for better visibility
                color: color,
              });
            } else if (annotation.type === "comment") {
              // Implement comment logic
            } else if (annotation.type === "signature") {
              if (annotation.imageData) {
                const pngImage = await pdfDoc.embedPng(annotation.imageData)
                page.drawImage(pngImage, {
                  x: annotation.position.x,
                  y: page.getHeight() - annotation.position.y - annotation.height,
                  width: annotation.width,
                  height: annotation.height,
                })
              }
            }
          }
        }

        // Serialize the PDF to bytes
        const pdfBytesModified = await pdfDoc.save()

        // Trigger the download
        const blob = new Blob([pdfBytesModified], { type: "application/pdf" })
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = "annotated.pdf"
        link.click()
      }

      fileReader.readAsArrayBuffer(pdfFile)
    } catch (error) {
      console.error("Error exporting PDF:", error)
    }
  }

  // Helper function to convert hex color to RGB for pdf-lib
  const hexToRgb = (hex: string, alpha: number = 1) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    return { type: 'RGB' as const, red: r, green: g, blue: b } // Fixed type for pdf-lib Color
  }

  // Add opacity separately as needed
  const withOpacity = (color: any, alpha: number) => {
    return { ...color, opacity: alpha }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="border-b p-4">
        <h1 className="text-2xl font-bold">PDF Annotator</h1>
      </header>

      <main className="flex-1 flex flex-col md:flex-row p-4 gap-4">
        {/* Left sidebar with tools */}
        <div className="w-full md:w-64 flex-shrink-0 space-y-4">
          <div className="p-4 border rounded-lg bg-card">
            <h2 className="font-semibold mb-4">Document</h2>

            {!pdfFile ? (
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Drag & drop a PDF here or click to browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0])
                    }
                  }}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm truncate">{pdfFile.name}</p>
                  <Button variant="ghost" size="icon" onClick={clearPdf} title="Remove PDF">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    Change
                  </Button>
                  <Button variant="default" size="sm" onClick={exportPDF}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            )}
          </div>

          {pdfFile && (
            <div className="p-4 border rounded-lg bg-card">
              <h2 className="font-semibold mb-4">Annotation Tools</h2>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-4 mb-4">
                  <TabsTrigger value="highlight" title="Highlight Text">
                    <Highlighter className="h-5 w-5" />
                  </TabsTrigger>
                  <TabsTrigger value="underline" title="Underline Text">
                    <Underline className="h-5 w-5" />
                  </TabsTrigger>
                  <TabsTrigger value="comment" title="Add Comment">
                    <MessageSquare className="h-5 w-5" />
                  </TabsTrigger>
                  <TabsTrigger value="signature" title="Add Signature">
                    <Pen className="h-5 w-5" />
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="highlight" className="space-y-4">
                  <p className="text-sm">Select text to highlight</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button 
                      className={`w-8 h-8 rounded-full bg-[#4285F4] ${activeColor === "#4285F4" ? 'ring-2 ring-offset-2 ring-black' : ''}`}
                      onClick={() => setActiveColor("#4285F4")}
                      title="Blue"
                    />
                    <button 
                      className={`w-8 h-8 rounded-full bg-[#FBC02D] ${activeColor === "#FBC02D" ? 'ring-2 ring-offset-2 ring-black' : ''}`}
                      onClick={() => setActiveColor("#FBC02D")}
                      title="Yellow"
                    />
                    <button 
                      className={`w-8 h-8 rounded-full bg-[#34A853] ${activeColor === "#34A853" ? 'ring-2 ring-offset-2 ring-black' : ''}`}
                      onClick={() => setActiveColor("#34A853")}
                      title="Green"
                    />
                    <button 
                      className={`w-8 h-8 rounded-full bg-[#EA4335] ${activeColor === "#EA4335" ? 'ring-2 ring-offset-2 ring-black' : ''}`}
                      onClick={() => setActiveColor("#EA4335")}
                      title="Pink"
                    />
                    <button 
                      className={`w-8 h-8 rounded-full bg-[#673AB7] ${activeColor === "#673AB7" ? 'ring-2 ring-offset-2 ring-black' : ''}`}
                      onClick={() => setActiveColor("#673AB7")}
                      title="Purple"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="underline" className="space-y-4">
                  <p className="text-sm">Select text to underline</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button 
                      className={`w-8 h-8 rounded-full bg-[#4285F4] ${activeColor === "#4285F4" ? 'ring-2 ring-offset-2 ring-black' : ''}`}
                      onClick={() => setActiveColor("#4285F4")}
                      title="Blue"
                    />
                    <button 
                      className={`w-8 h-8 rounded-full bg-[#FBC02D] ${activeColor === "#FBC02D" ? 'ring-2 ring-offset-2 ring-black' : ''}`}
                      onClick={() => setActiveColor("#FBC02D")}
                      title="Yellow"
                    />
                    <button 
                      className={`w-8 h-8 rounded-full bg-[#34A853] ${activeColor === "#34A853" ? 'ring-2 ring-offset-2 ring-black' : ''}`}
                      onClick={() => setActiveColor("#34A853")}
                      title="Green"
                    />
                    <button 
                      className={`w-8 h-8 rounded-full bg-[#EA4335] ${activeColor === "#EA4335" ? 'ring-2 ring-offset-2 ring-black' : ''}`}
                      onClick={() => setActiveColor("#EA4335")}
                      title="Pink"
                    />
                    <button 
                      className={`w-8 h-8 rounded-full bg-[#673AB7] ${activeColor === "#673AB7" ? 'ring-2 ring-offset-2 ring-black' : ''}`}
                      onClick={() => setActiveColor("#673AB7")}
                      title="Purple"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="comment" className="space-y-4">
                  <p className="text-sm">Click on the document to add a comment</p>
                  <p className="text-xs text-muted-foreground">Comments will appear in black</p>
                </TabsContent>

                <TabsContent value="signature" className="space-y-4">
                  <p className="text-sm">Click on the document where you want to add your signature</p>
                  <p className="text-xs text-muted-foreground">
                    Or click the button below to draw your signature first
                  </p>
                  <Button onClick={() => setIsDrawingSignature(true)} className="w-full">
                    Draw Signature
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {pdfFile && annotations.length > 0 && (
            <div className="p-4 border rounded-lg bg-card">
              <h2 className="font-semibold mb-4">Annotations</h2>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {annotations
                  .filter((anno) => anno.page === currentPage)
                  .map((anno) => (
                    <div key={anno.id} className="flex justify-between items-center p-2 bg-accent rounded">
                      <button
                        className="text-sm truncate text-left flex-1 hover:underline"
                        onClick={() => anno.type === "comment" && viewComment(anno.id)}
                      >
                        {anno.type === "comment"
                          ? `Comment: ${anno.text.substring(0, 20)}${anno.text.length > 20 ? "..." : ""}`
                          : anno.type === "signature"
                            ? "Signature"
                            : anno.type}
                      </button>
                      <Button variant="ghost" size="icon" onClick={() => removeAnnotation(anno.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Main document viewer */}
        <div className="flex-1 flex flex-col border rounded-lg bg-card overflow-hidden">
          {pdfFile ? (
            <>
              <div className="flex items-center justify-between p-2 border-b">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePageChange(-1)}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {numPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage >= numPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="icon" onClick={() => handleZoom(-0.1)} disabled={scale <= 0.5}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm w-16 text-center">{Math.round(scale * 100)}%</span>
                  <Button variant="outline" size="icon" onClick={() => handleZoom(0.1)} disabled={scale >= 2.5}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div 
                className={`flex-1 overflow-auto p-4 bg-muted/30 flex justify-center ${activeTab === "highlight" || activeTab === "underline" ? "text-selection-mode" : ""}`} 
                onClick={handleDocumentClick}
              >
                <div
                  ref={documentRef}
                  className={`relative shadow-lg ${activeTab === "highlight" || activeTab === "underline" ? "text-selection-mode" : ""}`}
                  style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}
                >
                  <Document 
                    file={pdfFile} 
                    onLoadSuccess={onDocumentLoadSuccess} 
                    className={`pdf-document ${activeTab === "highlight" || activeTab === "underline" ? "text-selection-mode" : ""}`}
                  >
                    <div className="relative">
                      <Page
                        pageNumber={currentPage}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        customTextRenderer={({ str }) => str}
                        className={activeTab === "highlight" || activeTab === "underline" ? "text-selection-mode" : ""}
                        onGetTextSuccess={(textContent) => {
                          if (activeTab === "highlight" || activeTab === "underline") {
                            const textLayer = document.querySelector('.react-pdf__Page__textContent');
                            if (textLayer) {
                              textLayer.classList.add('text-selection-mode');
                              
                              // Enhanced text span handling for better selection
                              const textSpans = textLayer.querySelectorAll('span');
                              textSpans.forEach(span => {
                                // Ensure each span is independently selectable
                                (span as HTMLElement).style.cursor = 'text';
                                (span as HTMLElement).style.userSelect = 'text';
                                (span as HTMLElement).style.pointerEvents = 'auto';
                                (span as HTMLElement).style.color = 'transparent';
                                
                                // Remove any transforms that might affect positioning
                                if ((span as HTMLElement).style.transform) {
                                  const transform = (span as HTMLElement).style.transform;
                                  if (!transform.includes('scale')) {
                                    // Keep the transform if it's not affecting scale
                                    (span as HTMLElement).setAttribute('data-original-transform', transform);
                                  }
                                }
                              });
                              
                              // Log the number of text spans for debugging
                              console.log(`${textSpans.length} text spans found in layer`);
                            }
                          }
                        }}
                      />
                      
                      <AnnotationLayer
                        annotations={annotations.filter((a) => a.page === currentPage)}
                        scale={scale}
                        activeTab={activeTab}
                        activeColor={activeColor}
                        onAddAnnotation={addAnnotation}
                        onUpdatePosition={updateAnnotationPosition}
                      />
                    </div>
                  </Document>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground">
              <div>
                <Upload className="mx-auto h-12 w-12 mb-4" />
                <h3 className="text-lg font-medium">No Document Loaded</h3>
                <p className="mt-2">Upload a PDF to get started</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {isDrawingSignature && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Draw Your Signature</h3>
            <p className="text-sm text-muted-foreground mb-4">Draw your signature in the box below</p>
            <SignatureCanvas ref={signatureCanvasRef} className="border rounded-lg bg-white w-full h-40" />
            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={() => setIsDrawingSignature(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (signatureCanvasRef.current) {
                    const data = signatureCanvasRef.current.toDataURL()
                    addSignature(data)
                  }
                }}
              >
                Add Signature
              </Button>
            </div>
          </div>
        </div>
      )}

      {isAddingComment && commentPosition && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Add Comment</h3>
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Enter your comment here..."
              className="min-h-[100px]"
            />
            <div className="flex justify-end space-x-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddingComment(false)
                  setCommentPosition(null)
                }}
              >
                Cancel
              </Button>
              <Button onClick={addComment}>Add Comment</Button>
            </div>
          </div>
        </div>
      )}

      {/* Comment View Dialog */}
      <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Comment</DialogTitle>
          </DialogHeader>
          <div className="p-4 border rounded bg-muted/20 max-h-[300px] overflow-y-auto">
            {selectedCommentId && (
              <p className="whitespace-pre-wrap">
                {annotations.find((anno) => anno.id === selectedCommentId)?.text || ""}
              </p>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsCommentDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

