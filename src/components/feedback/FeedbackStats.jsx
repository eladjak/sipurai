import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Star, 
  Lightbulb, 
  CheckCircle, 
  XCircle, 
  Clock,
  BarChart,
  FileText,
  FileImage,
  Languages,
  Users,
  MessageSquare,
  CircleUser,
  CalendarDays
} from 'lucide-react';
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function FeedbackStats({ feedback, book }) {
  // Calculate total ratings
  const ratingsCount = feedback.filter(f => f.rating > 0).length;
  
  // Calculate by type
  const typeCount = feedback.reduce((count, f) => {
    count[f.feedback_type] = (count[f.feedback_type] || 0) + 1;
    return count;
  }, {});
  
  // Calculate by status for suggestions
  const suggestions = feedback.filter(f => f.is_suggestion);
  const suggestionStatus = suggestions.reduce((count, f) => {
    count[f.status] = (count[f.status] || 0) + 1;
    return count;
  }, {});
  
  // Calculate average rating by type
  const ratingsByType = feedback.reduce((ratings, f) => {
    if (f.rating > 0) {
      if (!ratings[f.feedback_type]) {
        ratings[f.feedback_type] = { sum: 0, count: 0 };
      }
      ratings[f.feedback_type].sum += f.rating;
      ratings[f.feedback_type].count += 1;
    }
    return ratings;
  }, {});
  
  const averageRatingsByType = Object.keys(ratingsByType).reduce((avg, type) => {
    avg[type] = ratingsByType[type].sum / ratingsByType[type].count;
    return avg;
  }, {});
  
  // Create rating distribution
  const ratingDistribution = feedback.reduce((dist, f) => {
    if (f.rating > 0) {
      dist[f.rating] = (dist[f.rating] || 0) + 1;
    }
    return dist;
  }, {1: 0, 2: 0, 3: 0, 4: 0, 5: 0});
  
  // Calculate max value for distribution
  const maxDistValue = Math.max(...Object.values(ratingDistribution));
  
  // Get recent feedback
  const recentFeedback = [...feedback]
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 3);
  
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
  
  const getTypeColor = (type) => {
    const colors = {
      "general": "text-gray-500",
      "story": "text-blue-500",
      "illustrations": "text-purple-500",
      "language": "text-green-500",
      "age_appropriate": "text-amber-500"
    };
    
    return colors[type] || colors.general;
  };
  
  // Calculate the overall average rating
  const overallAvgRating = feedback.length > 0 
    ? feedback.reduce((sum, f) => sum + (f.rating || 0), 0) / 
      feedback.filter(f => f.rating > 0).length : 0;
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5 text-purple-600" />
            Feedback Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Rating section */}
          {ratingsCount > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                Ratings Overview
              </h3>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="text-4xl font-bold text-amber-500">
                  {overallAvgRating.toFixed(1)}
                </div>
                <div className="flex items-center">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star 
                      key={i}
                      className={`h-5 w-5 ${i < Math.round(overallAvgRating) ? 'text-amber-500 fill-amber-500' : 'text-gray-300'}`}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  from {ratingsCount} ratings
                </span>
              </div>
              
              {/* Rating distribution */}
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map(rating => (
                  <div key={rating} className="flex items-center gap-2">
                    <div className="w-4 text-xs text-gray-500">{rating}</div>
                    <Progress 
                      value={maxDistValue > 0 ? (ratingDistribution[rating] / maxDistValue) * 100 : 0} 
                      className="h-2" 
                    />
                    <div className="w-8 text-xs text-gray-500">{ratingDistribution[rating]}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Feedback by type */}
          <div>
            <h3 className="font-semibold mb-3">Feedback by Type</h3>
            <div className="space-y-3">
              {Object.keys(typeCount).length > 0 ? (
                Object.entries(typeCount).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={getTypeColor(type)}>
                        {getTypeIcon(type)}
                      </span>
                      <span className="capitalize">
                        {type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {averageRatingsByType[type] && (
                        <div className="flex items-center">
                          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                          <span className="text-sm">{averageRatingsByType[type].toFixed(1)}</span>
                        </div>
                      )}
                      <Badge>{count}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No feedback recorded yet
                </p>
              )}
            </div>
          </div>
          
          {/* Suggestions status */}
          {suggestions.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Suggestion Status
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Implemented</span>
                  </div>
                  <Badge variant="outline">{suggestionStatus.implemented || 0}</Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span>Accepted</span>
                  </div>
                  <Badge variant="outline">{suggestionStatus.accepted || 0}</Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    <span>Pending</span>
                  </div>
                  <Badge variant="outline">{suggestionStatus.pending || 0}</Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span>Declined</span>
                  </div>
                  <Badge variant="outline">{suggestionStatus.declined || 0}</Badge>
                </div>
              </div>
            </div>
          )}
          
          {/* Recent feedback */}
          {recentFeedback.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-gray-500" />
                Recent Feedback
              </h3>
              <div className="space-y-3">
                {recentFeedback.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <CircleUser className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">
                          {item.user?.full_name || "Unknown User"}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {format(new Date(item.created_date), "MMM d")}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1">
                        {item.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}