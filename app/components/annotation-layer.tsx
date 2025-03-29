"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface AnnotationLayerProps {
  annotations: any[]
  scale: number
  activeTab: string
  activeColor: string
  onAddAnnotation: (type: string, data: any) => void
  onUpdatePosition?: (id: number, newPosition: { x: number; y: number }) => void
}

export default function AnnotationLayer({
  annotations,
  scale,
  activeTab,
  activeColor,
  onAddAnnotation,
  onUpdatePosition,
}: AnnotationLayerProps) {
  const [selectedText, setSelectedText] = useState<string>("")
  const [selectedRange, setSelectedRange] = useState<Range | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const layerRef = useRef<HTMLDivElement>(null)

  // Function to get corrected text coordinates
  const getCorrectedTextCoordinates = (rect: DOMRect) => {
    const canvas = document.querySelector('.react-pdf__Page__canvas');
    const textLayer = document.querySelector('.react-pdf__Page__textContent');
    
    if (!canvas || !textLayer) {
      console.error('Canvas or text layer not found');
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    const canvasRect = canvas.getBoundingClientRect();
    
    return {
      x: (rect.left - canvasRect.left) / scale,
      y: (rect.top - canvasRect.top) / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    };
  };

  useEffect(() => {
    const handleSelection = () => {
      // Only process selection when in highlight or underline mode
      if (activeTab !== "highlight" && activeTab !== "underline") return;
      
      const selection = window.getSelection();
      if (selection && selection.toString().trim() !== "") {
        setSelectedText(selection.toString());
        if (selection.rangeCount > 0) {
          setSelectedRange(selection.getRangeAt(0));
        }
      }
    };

    // Use mouseup to capture completed selections
    document.addEventListener("mouseup", handleSelection);
    return () => {
      document.removeEventListener("mouseup", handleSelection);
    };
  }, [activeTab]);

  useEffect(() => {
    if (selectedText && selectedRange && (activeTab === "highlight" || activeTab === "underline")) {
      const range = selectedRange;
      const rects = range.getClientRects();

      if (!rects.length || !layerRef.current) return;

      // For word-level selection, process each rect individually
      Array.from(rects).forEach((rect) => {
        // Ensure the selection has a reasonable size (avoid tiny selections)
        if (rect.width > 2 && rect.height > 0) {
          // Get corrected position coordinates
          const position = getCorrectedTextCoordinates(rect);
          
          // Log position for debugging
          console.log('Creating annotation at:', position);

          onAddAnnotation(activeTab, {
            text: selectedText,
            position,
            color: activeColor,
          });
        }
      });

      // Clear selection
      window.getSelection()?.removeAllRanges();
      setSelectedText("");
      setSelectedRange(null);
    }
  }, [selectedText, selectedRange, activeTab, activeColor, onAddAnnotation, scale]);

  const handleMouseDown = (e: React.MouseEvent, id: number) => {
    if (!layerRef.current) return

    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const layerRect = layerRef.current.getBoundingClientRect()

    setDraggingId(id)
    setDragOffset({
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    })

    e.stopPropagation()
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingId === null || !layerRef.current) return

    const layerRect = layerRef.current.getBoundingClientRect()
    const x = (e.clientX - layerRect.left) / scale - dragOffset.x
    const y = (e.clientY - layerRect.top) / scale - dragOffset.y

    // Find the annotation being dragged
    const annotation = annotations.find((a) => a.id === draggingId)
    if (!annotation) return

    // Update the element position during drag
    const element = document.getElementById(`annotation-${draggingId}`)
    if (element) {
      if (annotation.type === "comment") {
        // For comments, adjust for the centered icon
        element.style.left = `${x - 12}px`
        element.style.top = `${y - 12}px`
      } else if (annotation.type === "underline") {
        // For underlines, only allow horizontal movement
        element.style.left = `${x}px`
      } else {
        // For other annotations
        element.style.left = `${x}px`
        element.style.top = `${y}px`
      }
    }
  }

  const handleMouseUp = () => {
    if (draggingId !== null && layerRef.current) {
      // Get the final position of the dragged element
      const annotationElement = document.getElementById(`annotation-${draggingId}`)
      if (annotationElement) {
        const left = Number.parseFloat(annotationElement.style.left)
        const top = Number.parseFloat(annotationElement.style.top)

        // Update the annotation position in the state
        if (onUpdatePosition) {
          onUpdatePosition(draggingId, { x: left, y: top })
        }
      }
    }
    setDraggingId(null)
  }

  useEffect(() => {
    if (draggingId !== null) {
      document.addEventListener("mousemove", handleMouseMove as any)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove as any)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [draggingId])

  useEffect(() => {
    // Configure page for text selection when highlight or underline is active
    if (activeTab === "highlight" || activeTab === "underline") {
      const textLayers = document.querySelectorAll('.react-pdf__Page__textContent');
      textLayers.forEach(layer => {
        (layer as HTMLElement).style.pointerEvents = 'auto';
        (layer as HTMLElement).style.opacity = '0.2'; // Increased opacity for better visibility
        
        // Make sure text spans are selectable
        const spans = layer.querySelectorAll('span');
        spans.forEach(span => {
          (span as HTMLElement).style.pointerEvents = 'auto';
          (span as HTMLElement).style.userSelect = 'text';
          (span as HTMLElement).style.cursor = 'text';
        });
      });
    } else {
      const textLayers = document.querySelectorAll('.react-pdf__Page__textContent');
      textLayers.forEach(layer => {
        (layer as HTMLElement).style.pointerEvents = 'none';
        (layer as HTMLElement).style.opacity = '0.01';
      });
    }
  }, [activeTab]);

  return (
    <div 
      ref={layerRef} 
      className={`absolute inset-0 pointer-events-none ${activeTab === "highlight" || activeTab === "underline" ? "text-selection-mode" : ""}`}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
    >
      {annotations.map((annotation) => {
        switch (annotation.type) {
          case "highlight":
            // Determine color class based on the color
            let colorClass = "highlight-blue"; // Default blue
            if (annotation.color === "#FBC02D") {
              colorClass = "highlight-yellow";
            } else if (annotation.color === "#34A853") {
              colorClass = "highlight-green";
            } else if (annotation.color === "#EA4335") {
              colorClass = "highlight-pink";
            } else if (annotation.color === "#673AB7") {
              colorClass = "highlight-purple";
            }

            return (
              <div
                id={`annotation-${annotation.id}`}
                key={annotation.id}
                className={`absolute pointer-events-auto cursor-pointer highlight-annotation ${colorClass}`}
                style={{
                  left: `${annotation.position.x}px`,
                  top: `${annotation.position.y}px`,
                  width: `${annotation.position.width}px`,
                  height: `${annotation.position.height}px`,
                  zIndex: 10,
                }}
                onMouseDown={(e) => handleMouseDown(e, annotation.id)}
                title={annotation.text}
              />
            )

          case "underline":
            // Determine color class based on the color
            let underlineColorClass = "underline-blue"; // Default blue
            if (annotation.color === "#FBC02D") {
              underlineColorClass = "underline-yellow";
            } else if (annotation.color === "#34A853") {
              underlineColorClass = "underline-green";
            } else if (annotation.color === "#EA4335") {
              underlineColorClass = "underline-pink";
            } else if (annotation.color === "#673AB7") {
              underlineColorClass = "underline-purple";
            }

            return (
              <div
                id={`annotation-${annotation.id}`}
                key={annotation.id}
                className={`absolute pointer-events-auto cursor-pointer underline-annotation underline-thick ${underlineColorClass}`}
                style={{
                  left: `${annotation.position.x}px`,
                  top: `${annotation.position.y + annotation.position.height - 1}px`,
                  width: `${annotation.position.width}px`,
                  height: `1px`,
                  zIndex: 10,
                }}
                onMouseDown={(e) => handleMouseDown(e, annotation.id)}
                title={annotation.text}
              />
            )

          case "comment":
            return (
              <TooltipProvider key={annotation.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      id={`annotation-${annotation.id}`}
                      className="absolute pointer-events-auto cursor-move flex items-center justify-center"
                      style={{
                        left: `${annotation.position.x - 12}px`,
                        top: `${annotation.position.y - 12}px`,
                        width: "24px",
                        height: "24px",
                        backgroundColor: "#000000", // Always black for comments
                        borderRadius: "50%",
                        zIndex: 20,
                      }}
                      onMouseDown={(e) => handleMouseDown(e, annotation.id)}
                    >
                      <span className="text-xs font-bold text-white">!</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <div className="text-sm font-medium">Comment</div>
                    <div className="text-xs mt-1">{annotation.text}</div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )

          case "signature":
            return (
              <div
                id={`annotation-${annotation.id}`}
                key={annotation.id}
                className="absolute pointer-events-auto cursor-move"
                style={{
                  left: `${annotation.position.x}px`,
                  top: `${annotation.position.y}px`,
                  width: `${annotation.width}px`,
                  height: `${annotation.height}px`,
                  zIndex: 30,
                }}
                onMouseDown={(e) => handleMouseDown(e, annotation.id)}
              >
                <img
                  src={annotation.imageData || "/placeholder.svg"}
                  alt="Signature"
                  className="w-full h-full object-contain"
                />
              </div>
            )

          default:
            return null
        }
      })}
    </div>
  )
}

