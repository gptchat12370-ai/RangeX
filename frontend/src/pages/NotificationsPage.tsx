import React, { useEffect, useState } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { formatDate } from "../lib/utils";
import { httpClient } from "../api/httpClient";
import { toast } from "sonner";

interface Notification {
  id: string;
  type?: "challenge" | "event" | "team" | "system" | "achievement";
  title: string;
  body: string; // Backend uses 'body' not 'message'
  createdAt: string;
  isRead: boolean;
  actionUrl?: string;
}

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const load = async () => {
    try {
      const { data } = await httpClient.get<Notification[]>("/notifications/unread");
      setNotifications(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load notifications");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await httpClient.post(`/notifications/${id}/read`, {});
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (e) {
      console.error(e);
    }
  };

  const markAllAsRead = async () => {
    const ids = notifications.filter((n) => !n.isRead).map((n) => n.id);
    await Promise.all(ids.map((id) => httpClient.post(`/notifications/${id}/read`, {})));
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const removeLocal = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const getNotificationIcon = (type?: Notification["type"]) => {
    switch (type) {
      case "achievement":
        return "🏆";
      case "event":
        return "📅";
      case "team":
        return "👥";
      case "system":
        return "⚙️";
      case "challenge":
        return "🎯";
      default:
        return "🔔";
    }
  };

  const getNotificationColor = (type?: Notification["type"]) => {
    switch (type) {
      case "achievement":
        return "bg-yellow-500/20 text-yellow-400";
      case "event":
        return "bg-primary/20 text-primary";
      case "team":
        return "bg-purple-500/20 text-purple-400";
      case "system":
        return "bg-gray-500/20 text-gray-400";
      case "challenge":
        return "bg-green-500/20 text-green-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const renderNotificationsList = (list: Notification[]) => {
    if (list.length === 0) {
      return (
        <div className="text-center py-12">
          <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No notifications</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {list.map((notification) => (
          <Card
            key={notification.id}
            className={`transition-colors ${!notification.isRead ? "border-primary/50 bg-primary/5" : ""}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${getNotificationColor(
                    notification.type
                  )}`}
                >
                  <span className="text-xl">{getNotificationIcon(notification.type)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{notification.title}</h3>
                        {!notification.isRead && (
                          <Badge variant="default" className="h-5 text-xs">
                            New
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.body}</p>
                      <p className="text-xs text-muted-foreground mt-2">{formatDate(notification.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => markAsRead(notification.id)}
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeLocal(notification.id)}
                        title="Dismiss"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center relative">
            <Bell className="h-6 w-6 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-6 w-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold">Notifications</h1>
            <p className="text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "All caught up!"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead} className="gap-2">
              <Check className="h-4 w-4" />
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">All {notifications.length > 0 && `(${notifications.length})`}</TabsTrigger>
          <TabsTrigger value="unread">Unread {unreadCount > 0 && `(${unreadCount})`}</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="all">{renderNotificationsList(notifications)}</TabsContent>

        <TabsContent value="unread">{renderNotificationsList(notifications.filter((n) => !n.isRead))}</TabsContent>

        <TabsContent value="events">{renderNotificationsList(notifications.filter((n) => n.type === "event"))}</TabsContent>
      </Tabs>
    </div>
  );
}
