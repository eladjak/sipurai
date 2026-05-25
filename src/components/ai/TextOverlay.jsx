import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Save,
  Download,
  Plus,
  Minus,
  AlignCenter,
  AlignLeft,
  AlignRight
} from 'lucide-react';
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n/i18nProvider";

export default function TextOverlay({ imageUrl, onSave, onCancel, currentLanguage = "hebrew" }) {
  const { t, isRTL } = useI18n();

  const [textElements, setTextElements] = useState([
    {
      id: 1,
      text: t("textOverlay.sampleText"),
      fontSize: 32,
      color: '#FFFFFF',
      position: { x: 50, y: 50 },
      fontFamily: isRTL ? 'Heebo' : 'Arial',
      fontWeight: '700',
      textAlign: 'center',
      shadowColor: '#000000',
      shadowBlur: 3
    }
  ]);

  const [selectedElement, setSelectedElement] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const hebrewFonts = [
    { value: 'Heebo', label: 'Heebo (מודרני)' },
    { value: 'Assistant', label: 'Assistant (קריא)' },
    { value: 'Rubik', label: 'Rubik (עגול)' },
    { value: 'David', label: 'David (קלסי)' },
    { value: 'Miriam', label: 'Miriam (מסורתי)' }
  ];

  const englishFonts = [
    { value: 'Arial', label: 'Arial' },
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Times New Roman', label: 'Times New Roman' },
    { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Comic Sans MS', label: 'Comic Sans' }
  ];

  const fontOptions = isRTL ? hebrewFonts : englishFonts;

  const handleMouseDown = (elementIndex, e) => {
    setSelectedElement(elementIndex);
    setIsDragging(true);
    const containerRect = containerRef.current.getBoundingClientRect();
    const element = textElements[elementIndex];
    setDragStart({
      x: e.clientX - element.position.x * containerRect.width / 100,
      y: e.clientY - element.position.y * containerRect.height / 100,
    });
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newX = ((e.clientX - dragStart.x) / containerRect.width) * 100;
    const newY = ((e.clientY - dragStart.y) / containerRect.height) * 100;
    
    updateTextElement(selectedElement, {
      position: {
        x: Math.max(0, Math.min(100, newX)),
        y: Math.max(0, Math.min(100, newY)),
      }
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, selectedElement]);

  const updateTextElement = (index, updates) => {
    setTextElements(prev => prev.map((element, i) => 
      i === index ? { ...element, ...updates } : element
    ));
  };

  const addTextElement = () => {
    const newElement = {
      id: Date.now(),
      text: t("textOverlay.newText"),
      fontSize: 24,
      color: '#FFFFFF',
      position: { x: 30 + textElements.length * 10, y: 30 + textElements.length * 10 },
      fontFamily: isRTL ? 'Heebo' : 'Arial',
      fontWeight: '700',
      textAlign: 'center',
      shadowColor: '#000000',
      shadowBlur: 3
    };
    setTextElements(prev => [...prev, newElement]);
    setSelectedElement(textElements.length);
  };

  const generateFinalImage = async () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Create image object
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    return new Promise((resolve) => {
      img.onload = () => {
        // Set canvas dimensions to match image
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw the background image
        ctx.drawImage(img, 0, 0);
        
        // Draw each text element
        textElements.forEach(element => {
          const x = (element.position.x / 100) * canvas.width;
          const y = (element.position.y / 100) * canvas.height;
          
          ctx.font = `${element.fontWeight} ${element.fontSize * (canvas.width / 400)}px ${element.fontFamily}`;
          ctx.fillStyle = element.color;
          ctx.textAlign = element.textAlign;
          ctx.textBaseline = 'middle';
          ctx.direction = isRTL ? 'rtl' : 'ltr';
          
          // Add shadow
          ctx.shadowColor = element.shadowColor;
          ctx.shadowBlur = element.shadowBlur;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;
          
          // Draw text
          ctx.fillText(element.text, x, y);
          
          // Reset shadow
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        });
        
        // Convert to blob and resolve
        canvas.toBlob(resolve, 'image/png');
      };
      
      img.src = imageUrl;
    });
  };

  const handleSave = async () => {
    const blob = await generateFinalImage();
    onSave({ 
      imageBlob: blob,
      textElements: textElements,
      originalImageUrl: imageUrl 
    });
  };

  const handleDownload = async () => {
    const blob = await generateFinalImage();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'image-with-text.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentElement = textElements[selectedElement];

  return (
    <TooltipProvider>
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6" dir={isRTL ? "rtl" : "ltr"}>
        
        {/* Image Preview */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("textOverlay.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                ref={containerRef}
                className="relative w-full aspect-square overflow-hidden rounded-md border-2 border-dashed border-gray-300 cursor-crosshair"
                style={{ maxHeight: '500px' }}
              >
                <img
                  src={imageUrl}
                  alt="Generated image"
                  className="w-full h-full object-cover select-none"
                  draggable="false"
                  loading="lazy"
                />
                
                {textElements.map((element, index) => (
                  <div
                    key={element.id}
                    className={`absolute cursor-move border-2 ${
                      selectedElement === index ? 'border-blue-500' : 'border-transparent'
                    } rounded-sm`}
                    style={{
                      left: `${element.position.x}%`,
                      top: `${element.position.y}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: `${element.fontSize * 0.8}px`,
                      color: element.color,
                      fontFamily: element.fontFamily,
                      fontWeight: element.fontWeight,
                      textAlign: element.textAlign,
                      textShadow: `1px 1px ${element.shadowBlur}px ${element.shadowColor}`,
                      direction: isRTL ? 'rtl' : 'ltr',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'auto',
                      zIndex: selectedElement === index ? 10 : 1
                    }}
                    onMouseDown={(e) => handleMouseDown(index, e)}
                    onClick={() => setSelectedElement(index)}
                  >
                    {element.text}
                  </div>
                ))}
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-between mt-4">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={addTextElement}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t("textOverlay.addText")}
                  </Button>
                  <Button variant="outline" onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    {t("textOverlay.download")}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onCancel}>
                    {t("textOverlay.cancel")}
                  </Button>
                  <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700">
                    <Save className="h-4 w-4 mr-2" />
                    {t("textOverlay.save")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Text Controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {t("textOverlay.subtitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentElement && (
                <>
                  <div>
                    <Label htmlFor="text-content">{t("textOverlay.text")}</Label>
                    <Textarea
                      id="text-content"
                      value={currentElement.text}
                      onChange={(e) => updateTextElement(selectedElement, { text: e.target.value })}
                      className="mt-1"
                      dir={isRTL ? "rtl" : "ltr"}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="font-size">{t("textOverlay.fontSize")}</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => updateTextElement(selectedElement, { 
                            fontSize: Math.max(12, currentElement.fontSize - 2) 
                          })}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          id="font-size"
                          type="number"
                          value={currentElement.fontSize}
                          onChange={(e) => updateTextElement(selectedElement, { 
                            fontSize: parseInt(e.target.value) || 16 
                          })}
                          className="text-center"
                          min="12"
                          max="72"
                        />
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => updateTextElement(selectedElement, { 
                            fontSize: Math.min(72, currentElement.fontSize + 2) 
                          })}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="text-color">{t("textOverlay.color")}</Label>
                      <Input
                        id="text-color"
                        type="color"
                        value={currentElement.color}
                        onChange={(e) => updateTextElement(selectedElement, { color: e.target.value })}
                        className="mt-1 h-10"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="font-family">{t("textOverlay.fontFamily")}</Label>
                    <Select
                      value={currentElement.fontFamily}
                      onValueChange={(value) => updateTextElement(selectedElement, { fontFamily: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fontOptions.map(font => (
                          <SelectItem key={font.value} value={font.value}>
                            {font.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>{t("textOverlay.textAlign")}</Label>
                    <div className="flex gap-1 mt-1">
                      <Button
                        variant={currentElement.textAlign === 'left' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateTextElement(selectedElement, { textAlign: 'left' })}
                      >
                        <AlignLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={currentElement.textAlign === 'center' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateTextElement(selectedElement, { textAlign: 'center' })}
                      >
                        <AlignCenter className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={currentElement.textAlign === 'right' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateTextElement(selectedElement, { textAlign: 'right' })}
                      >
                        <AlignRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Hidden canvas for image generation */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </TooltipProvider>
  );
}