import React, { useEffect, useState } from "react";
import { adminApi } from "../../api/adminApi";
import { Badge as BadgeIcon, Plus, Edit, Trash } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";

export function BadgesPage() {
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<any | null>(null);

  useEffect(() => {
    loadBadges();
  }, []);

  const loadBadges = async () => {
    setLoading(true);
    try {
      const data = await adminApi.listBadges();
      setBadges(data);
    } catch (error) {
      toast.error("Failed to load badges");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());

    try {
      if (editingBadge) {
        await adminApi.updateBadge(editingBadge.id, data);
        toast.success("Badge updated successfully");
      } else {
        await adminApi.createBadge(data);
        toast.success("Badge created successfully");
      }
      loadBadges();
      setDialogOpen(false);
      setEditingBadge(null);
    } catch (error) {
      toast.error("Failed to save badge");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminApi.deleteBadge(id);
      toast.success("Badge deleted successfully");
      loadBadges();
    } catch (error) {
      toast.error("Failed to delete badge");
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BadgeIcon className="h-6 w-6" />
          Manage Badges
        </h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingBadge(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Badge
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBadge ? "Edit" : "Create"} Badge</DialogTitle>
              <DialogDescription>
                {editingBadge ? "Edit the" : "Create a new"} badge for users to earn.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input id="name" name="name" defaultValue={editingBadge?.name} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right">
                    Description
                  </Label>
                  <Input id="description" name="description" defaultValue={editingBadge?.description} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="iconUrl" className="text-right">
                    Icon URL
                  </Label>
                  <Input id="iconUrl" name="iconUrl" defaultValue={editingBadge?.iconUrl} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="criteria" className="text-right">
                    Criteria
                  </Label>
                  <Input id="criteria" name="criteria" defaultValue={editingBadge?.criteria} className="col-span-3" placeholder="e.g., challenges_5" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p>Loading badges...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Criteria</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {badges.map((badge) => (
              <TableRow key={badge.id}>
                <TableCell>{badge.name}</TableCell>
                <TableCell>{badge.description}</TableCell>
                <TableCell>{badge.criteria}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => { setEditingBadge(badge); setDialogOpen(true); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(badge.id)}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
