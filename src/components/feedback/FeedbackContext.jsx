import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  BookMarked,
  BookUp
} from 'lucide-react';

export default function FeedbackContext({ book, pages, currentPageIndex, setCurrentPageIndex }) {
  const [activeTab, setActiveTab] = useState("pages");
  
  // Jump to a specific page
  const handlePageClick = (index) => {
    setCurrentPageIndex(index);
  };
  
  // Truncate text for preview
  const truncateText = (text, maxLength = 80) => {
    if (!text) return "No content";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + "...";
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookMarked className="h-5 w-5 text-purple-600" />
          Book Context
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pages" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="pages" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Pages
            </TabsTrigger>
            <TabsTrigger value="info" className="flex items-center gap-2">
              <BookUp className="h-4 w-4" />
              Book Info
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="pages">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {pages.map((page, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-md border cursor-pointer transition-all ${
                      currentPageIndex === index
                        ? "bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800"
                        : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                    }`}
                    onClick={() => handlePageClick(index)}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <Badge
                        variant={currentPageIndex === index ? "default" : "outline"}
                        className={currentPageIndex === index ? "bg-purple-500" : ""}
                      >
                        Page {index + 1}
                      </Badge>
                      {currentPageIndex === index && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {truncateText(page.text_content)}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="info">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Title</h3>
                <p className="text-gray-900 dark:text-white font-medium">{book?.title}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">For</h3>
                <p className="text-gray-900 dark:text-white">
                  {book?.child_name}, {book?.child_age} years old
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Genre</h3>
                <p className="text-gray-900 dark:text-white capitalize">
                  {book?.genre?.replace(/_/g, ' ')}
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Target Age Range</h3>
                <p className="text-gray-900 dark:text-white">{book?.age_range} years</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Art Style</h3>
                <p className="text-gray-900 dark:text-white capitalize">
                  {book?.art_style?.replace(/_/g, ' ')}
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Language</h3>
                <p className="text-gray-900 dark:text-white capitalize">{book?.language}</p>
              </div>
              
              {book?.interests && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Child's Interests</h3>
                  <p className="text-gray-900 dark:text-white">
                    {book.interests}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}