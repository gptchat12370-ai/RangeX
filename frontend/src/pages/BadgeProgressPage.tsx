import { useState, useEffect } from 'react';
import { Trophy, CheckCircle, Circle, Lock, Award } from 'lucide-react';
import { getAssetUrl } from '../utils/assetUrl';
import { httpClient } from '../api/httpClient';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';

interface BadgeProgress {
  badge: {
    id: string;
    name: string;
    description: string;
    iconUrl: string;
    criteria: string;
  };
  requirements: {
    scenarioId: string;
    scenarioName: string;
    completed: boolean;
  }[];
  earned: boolean;
  earnedAt?: string;
  progress: number;
  completedCount: number;
  totalCount: number;
}

export default function BadgeProgressPage() {
  const [progress, setProgress] = useState<BadgeProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'earned' | 'in-progress'>('all');

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const userResponse = await httpClient.get('/account/me');
      const userId = userResponse.data.id;

      const response = await httpClient.get(`/badges/progress/${userId}`);
      setProgress(response.data);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load badge progress');
    } finally {
      setLoading(false);
    }
  };

  const filteredProgress = progress.filter(item => {
    if (filter === 'earned') return item.earned;
    if (filter === 'in-progress') return !item.earned && item.completedCount > 0;
    return true;
  });

  const earnedCount = progress.filter(p => p.earned).length;
  const inProgressCount = progress.filter(p => !p.earned && p.completedCount > 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-muted-foreground">Loading badge progress...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Award className="h-8 w-8 text-primary" />
            Badge Progress
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your progress towards earning all {progress.length} badges
          </p>
        </div>
        <div className="flex gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{earnedCount}</div>
                <div className="text-xs text-muted-foreground">Earned</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">{inProgressCount}</div>
                <div className="text-xs text-muted-foreground">In Progress</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="w-full">
        <TabsList>
          <TabsTrigger value="all">
            All Badges ({progress.length})
          </TabsTrigger>
          <TabsTrigger value="earned">
            Earned ({earnedCount})
          </TabsTrigger>
          <TabsTrigger value="in-progress">
            In Progress ({inProgressCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Badge Cards */}
      <div className="grid gap-4">
        {filteredProgress.map(item => (
          <Card
            key={item.badge.id}
            className={`transition-all ${
              item.earned
                ? 'bg-gradient-to-r from-yellow-900/30 via-gray-900 to-gray-900 border-yellow-600/50'
                : ''
            }`}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                {/* Badge Icon */}
                <div className="relative">
                  <Avatar className={`h-20 w-20 ${!item.earned ? 'opacity-50 grayscale' : ''}`}>
                    <AvatarImage src={getAssetUrl(item.badge.iconUrl)} alt={item.badge.name} />
                    <AvatarFallback className="bg-primary/10">
                      <Award className="h-10 w-10 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  {item.earned && (
                    <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-1.5 shadow-lg">
                      <Trophy size={16} className="text-gray-900" />
                    </div>
                  )}
                  {!item.earned && item.completedCount === 0 && (
                    <div className="absolute -bottom-1 -right-1 bg-gray-700 rounded-full p-1.5">
                      <Lock size={14} className="text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Badge Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold">{item.badge.name}</h3>
                    {item.earned && (
                      <Badge className="bg-yellow-600 hover:bg-yellow-600 text-xs font-bold">
                        EARNED
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mb-4">{item.badge.description}</p>

                  {/* Progress Bar for Scenario-Specific Badges */}
                  {item.totalCount > 0 ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {item.completedCount} / {item.totalCount} scenarios completed
                          </span>
                          <span className="font-bold text-blue-400">{item.progress}%</span>
                        </div>
                        <Progress value={item.progress} className="h-2" />
                      </div>

                      {/* Requirements List */}
                      <div className="mt-4">
                        <p className="text-sm font-medium mb-2 text-muted-foreground">
                          Required Scenarios:
                        </p>
                        <div className="space-y-1">
                          {item.requirements.map(req => (
                            <div key={req.scenarioId} className="flex items-center gap-2">
                              {req.completed ? (
                                <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                              ) : (
                                <Circle size={16} className="text-gray-600 flex-shrink-0" />
                              )}
                              <span
                                className={`text-sm ${
                                  req.completed ? 'text-green-400 line-through' : 'text-muted-foreground'
                                }`}
                              >
                                {req.scenarioName}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {item.badge.criteria}
                      </Badge>
                    </div>
                  )}

                  {/* Earned Date */}
                  {item.earned && item.earnedAt && (
                    <p className="text-xs text-muted-foreground mt-4">
                      🏆 Earned on {new Date(item.earnedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredProgress.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Award className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No badges found</p>
              <p className="text-muted-foreground">
                {filter === 'earned'
                  ? "You haven't earned any badges yet. Complete challenges to unlock them!"
                  : filter === 'in-progress'
                  ? "You don't have any badges in progress. Start working on challenges!"
                  : 'No badges are available at this time.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
