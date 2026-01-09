import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { creatorApi } from "../api/creatorApi";

export function FavoritesPage() {
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);

  useEffect(() => {
    const redirectToFavorites = async () => {
      if (!currentUser?.id) {
        navigate("/playlists");
        return;
      }

      try {
        // Ensure favorites playlist exists
        const favorites = await creatorApi.ensureFavoritesPlaylist(currentUser.id);
        
        if (favorites?.id) {
          // Redirect to the Favorites playlist detail page
          navigate(`/playlists/${favorites.id}`, { replace: true });
        } else {
          navigate("/playlists");
        }
      } catch (error) {
        console.error("Failed to load favorites:", error);
        navigate("/playlists");
      }
    };

    redirectToFavorites();
  }, [currentUser?.id, navigate]);

  // Show loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto" />
        <p className="mt-4 text-muted-foreground">Loading your favorites...</p>
      </div>
    </div>
  );
}
