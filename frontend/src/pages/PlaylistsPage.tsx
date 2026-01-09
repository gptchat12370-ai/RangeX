import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, List } from "lucide-react";
import { creatorApi } from "../api/creatorApi";
import { getAssetUrl } from "../utils/assetUrl";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Trash2 } from "lucide-react";
import { useStore } from "../lib/store";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Card, CardContent } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { SafeImage } from "../lib/imageUtils";

interface PlaylistRow {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  isPublic?: boolean;
  items?: any[];
  ownerUserId?: string;
}

export function PlaylistsPage() {
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const [loading, setLoading] = useState(true);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      // Ensure favorites playlist exists
      if (currentUser?.id) {
        try {
          await creatorApi.ensureFavoritesPlaylist(currentUser.id);
        } catch {
          // Ignore if ensureFavorites fails
        }
      }
      const data = await creatorApi.listPlaylists();
      setPlaylists(data || []);
    } catch {
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlaylists();
  }, [currentUser?.id]);

  const filteredPlaylists = playlists.filter((playlist) =>
    playlist.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (playlist.description || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Deduplicate Favorites - keep only first one per user
  const seenFavorites = new Set<string>();
  const deduplicatedPlaylists = filteredPlaylists.filter((playlist) => {
    if (playlist.title.toLowerCase() === 'favorites') {
      const key = `${playlist.ownerUserId}-favorites`;
      if (seenFavorites.has(key)) {
        return false; // Skip duplicate
      }
      seenFavorites.add(key);
    }
    return true;
  });

  const myPlaylists = deduplicatedPlaylists.filter((p) => p.ownerUserId === currentUser?.id);
  const favoritesPlaylist = myPlaylists.find((p) => p.title.toLowerCase() === 'favorites');
  const otherMyPlaylists = myPlaylists.filter((p) => p.title.toLowerCase() !== 'favorites');
  const publicPlaylists = deduplicatedPlaylists.filter((p) => p.isPublic && p.ownerUserId !== currentUser?.id);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await creatorApi.deletePlaylist(deleteId);
      await loadPlaylists();
      setDeleteId(null);
    } catch {
      // swallow
    }
  };

  const renderPlaylistCard = (playlist: PlaylistRow) => (
    <Card 
      key={playlist.id} 
      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => navigate(`/playlists/${playlist.id}`)}
    >
      <SafeImage
        src={playlist.coverImageUrl}
        alt={playlist.title}
        className="w-full h-48 object-cover"
        fallbackType="playlist"
        fallbackClassName="h-48"
      />
      <CardContent className="p-4 space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3>{playlist.title}</h3>
            {playlist.isPublic && playlist.title.toLowerCase() !== 'favorites' && (
              <Badge variant="outline" className="text-xs">Public</Badge>
            )}
            {playlist.title.toLowerCase() === 'favorites' && (
              <Badge variant="secondary" className="text-xs">Private</Badge>
            )}
          </div>
          {playlist.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {playlist.description}
            </p>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{playlist.items?.length || 0} scenarios</div>
        {playlist.ownerUserId === currentUser?.id && playlist.title.toLowerCase() !== 'favorites' && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={(e) => { e.stopPropagation(); setDeleteId(playlist.id); }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <List className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Playlists</h1>
            <p className="text-muted-foreground">
              Curated collections of challenges to build your skills
            </p>
          </div>
        </div>
        
        <Button onClick={() => navigate("/playlists/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Create Playlist
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search playlists..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs defaultValue="mine" className="space-y-6">
        <TabsList>
          <TabsTrigger value="mine">
            My Playlists ({myPlaylists.length})
          </TabsTrigger>
          <TabsTrigger value="community">
            Community ({publicPlaylists.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : myPlaylists.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground mb-4">No playlists yet</p>
              <Button onClick={() => navigate("/playlists/new")}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Playlist
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favoritesPlaylist && renderPlaylistCard(favoritesPlaylist)}
              {otherMyPlaylists.map(renderPlaylistCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="community">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <Skeleton className="h-40 w-full" />
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : publicPlaylists.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {publicPlaylists.map(renderPlaylistCard)}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No community playlists found</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete playlist?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
