"use client"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

interface ColorPickerProps {
  color: string
  onChange: (color: string) => void
  label?: string
}

const predefinedColors = [
  "#4285F4", // Google Blue (similar to the image)
  "#FFFF00", // Yellow
  "#A5D6A7", // Light Green
  "#F48FB1", // Light Pink
  "#FFE082", // Light Amber
  "#FFCC80", // Light Orange
  "#B39DDB", // Light Purple
  "#E6EE9C", // Light Lime
]

export default function ColorPicker({ color, onChange, label }: ColorPickerProps) {
  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start">
            <div className="h-4 w-4 rounded-full mr-2" style={{ backgroundColor: color }} />
            <span>{color}</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-64">
          <div className="grid grid-cols-4 gap-2">
            {predefinedColors.map((c) => (
              <button
                key={c}
                className="h-8 w-8 rounded-full border border-muted-foreground/20 cursor-pointer"
                style={{ backgroundColor: c }}
                onClick={() => onChange(c)}
              />
            ))}
          </div>
          <div className="mt-4">
            <Label htmlFor="custom-color">Custom Color</Label>
            <input
              id="custom-color"
              type="color"
              value={color}
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-8 mt-1"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

