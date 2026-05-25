
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";

export default function EmptyState({ title, description, icon, actionLabel, actionLink }) {
  return (
    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-gray-800/50 dark:to-gray-800/30 border-dashed border-purple-200 dark:border-gray-700">
      <CardContent className="p-10 md:p-16 text-center flex flex-col items-center">
        <div className="rounded-full bg-purple-100 dark:bg-purple-900/30 p-5 mb-6">
          {icon}
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{title}</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto text-base leading-relaxed">
          {description}
        </p>
        {actionLabel && actionLink && (
          <Link to={actionLink}>
            <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-base px-8 py-3 h-auto">
              <PlusCircle className="h-5 w-5 mr-2" />
              {actionLabel}
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
