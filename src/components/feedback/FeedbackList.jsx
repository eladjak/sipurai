import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  MoreVertical, 
  Star,
  Lightbulb,
  MessageSquare,
  FileText,
  FileImage,
  Languages,
  Users
} from 'lucide-react';
import { format } from "date-fns";

export default function FeedbackList({ feedback, isOwner, isCollaborator, onUpdateStatus, currentUser }) {
  if (!feedback || feedback.length === 0) {
    return (
      <div className="text-center py-12 px-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
        <MessageSquare className="h-12 w-12 mx-auto text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No feedback yet</h3>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          No one has provided feedback for this page yet
        </p>
      </div>
    );
  }
  
  const getStatusBadge = (status) => {
    switch (status)  {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "accepted":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        );
      case "implemented":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Implemented
          </Badge>
        );
      case "declined":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Declined
          </Badge>
        );
      default:
        return null;
    }
  };
  
  const getTypeIcon = (type) => {
    switch (type) {
      case "general":
        return <MessageSquare className="h-4 w-4" />;
      case "story":
        return <FileText className="h-4 w-4" />;
      case "illustrations":
        return <FileImage className="h-4 w-4" />;
      case "language":
        return <Languages className="h-4 w-4" />;
      case "age_appropriate":
        return <Users className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };
  
  const getTypeBadge = (type) => {
    const labels = {
      "general": "General",
      "story": "Story",
      "illustrations": "Illustrations",
      "language": "Language",
      "age_appropriate": "Age Appropriate"
    };
    
    const colors = {
      "general": "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
      "story": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      "illustrations": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      "language": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      "age_appropriate": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
    };
    
    return (
      <Badge className={colors[type] || colors.general}>
        {getTypeIcon(type)}
        <span className="ml-1">{labels[type] || "Feedback"}</span>
      </Badge>
    );
  };
  
  const renderFeedbackItem = (item) => {
    return (
      <Card key={item.id} className="p-4 mb-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            {item.user?.avatar_url ? (
              <AvatarImage src={item.user.avatar_url} alt={item.user.full_name} />
            ) : null}
            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-indigo-500 text-white">
              {item.user?.full_name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-medium">
                {item.user?.full_name || "Unknown User"}
              </span>
              
              {item.user?.id === currentUser?.id && (
                <Badge variant="outline" className="text-xs">
                  You
                </Badge>
              )}
              
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {item.created_date && format(new Date(item.created_date), "MMM d, yyyy 'at' h:mm a")}
              </span>
              
              {getTypeBadge(item.feedback_type)}
              
              {item.is_suggestion && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  <Lightbulb className="h-3 w-3 mr-1" />
                  Suggestion
                </Badge>
              )}
              
              {getStatusBadge(item.status)}
            </div>
            
            {/* Rating */}
            {item.rating && (
              <div className="flex items-center mb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star 
                    key={i}
                    className={`h-4 w-4 ${i < item.rating ? 'text-amber-500 fill-amber-500' : 'text-gray-300'}`}
                  />
                ))}
              </div>
            )}
            
            {/* Feedback content */}
            <p className="text-gray-700 dark:text-gray-300 mb-2 whitespace-pre-line">
              {item.content}
            </p>
            
            {/* Privacy indicator */}
            {item.privacy !== "public" && (
              <Badge variant="outline" className="text-xs">
                {item.privacy === "private" ? "Private feedback" : "Visible to collaborators only"}
              </Badge>
            )}
          </div>
          
          {/* Actions for book owner or collaborator */}
          {(isOwner || isCollaborator) && item.is_suggestion && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {item.status !== "implemented" && (
                  <DropdownMenuItem 
                    onClick={() => onUpdateStatus(item.id, "implemented")}
                    className="text-green-600 dark:text-green-400"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Implemented
                  </DropdownMenuItem>
                )}
                
                {item.status !== "accepted" && item.status !== "implemented" && (
                  <DropdownMenuItem onClick={() => onUpdateStatus(item.id, "accepted")}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Accept Suggestion
                  </DropdownMenuItem>
                )}
                
                {item.status !== "declined" && (
                  <DropdownMenuItem 
                    onClick={() => onUpdateStatus(item.id, "declined")}
                    className="text-red-600 dark:text-red-400"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Decline Suggestion
                  </DropdownMenuItem>
                )}
                
                {item.status !== "pending" && (
                  <DropdownMenuItem onClick={() => onUpdateStatus(item.id, "pending")}>
                    <Clock className="h-4 w-4 mr-2" />
                    Reset to Pending
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </Card>
    );
  };
  
  return (
    <div className="space-y-4">
      {feedback.map(renderFeedbackItem)}
    </div>
  );
}