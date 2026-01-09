import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  UserPlus,
  MoreVertical,
  Ban,
  Mail,
  Edit,
  Trash2,
  Download,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { toast } from "sonner";
import { adminApi } from "../../api/adminApi";

interface User {
  id: string;
  username: string;
  email: string;
  role: "solver" | "creator" | "admin";
  status: "active" | "suspended" | "pending";
  createdAt: string;
  lastActive: string;
  scenariosCompleted?: number;
  scenariosCreated?: number;
}

export function UsersManagementPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<User>>({});
  const [createFormData, setCreateFormData] = useState({
    fullName: "",
    email: "",
    username: "",
    role: "solver" as "solver" | "creator" | "admin",
    password: "",
    status: "active" as "active" | "suspended",
    generatePassword: false,
  });
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await adminApi.listUsers();
        setUsers(
          data.map((u) => ({
            id: u.id,
            username: u.displayName || u.email,
            email: u.email,
            role: u.roleAdmin ? "admin" : u.roleCreator ? "creator" : "solver",
            status: u.isActive ? "active" : "suspended",
            createdAt: u.createdAt,
            lastActive: u.updatedAt,
          }))
        );
      } catch (err: any) {
        toast.error(err?.response?.data?.message || "Failed to load users");
      }
    };
    load();
  }, []);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      searchQuery === "" ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.status === "active").length,
    pending: users.filter((u) => u.status === "pending").length,
    suspended: users.filter((u) => u.status === "suspended").length,
    solvers: users.filter((u) => u.role === "solver").length,
    creators: users.filter((u) => u.role === "creator").length,
    admins: users.filter((u) => u.role === "admin").length,
  }), [users]);

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditFormData({
      role: user.role,
      status: user.status,
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    try {
      const updated = await adminApi.updateUser(selectedUser.id, {
        role: editFormData.role,
        isActive: editFormData.status !== "suspended",
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? {
                ...u,
                username: updated.displayName || updated.email,
                email: updated.email,
                role: updated.roleAdmin ? "admin" : updated.roleCreator ? "creator" : "solver",
                status: updated.isActive ? "active" : "suspended",
              }
            : u
        )
      );
      toast.success(`User ${selectedUser.username} updated successfully`);
      setShowEditDialog(false);
      setSelectedUser(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update user");
    }
  };

  const handleCreateUser = async () => {
    if (!createFormData.email || !createFormData.username) {
      toast.error("Email and username are required");
      return;
    }
    
    if (!createFormData.generatePassword && !createFormData.password) {
      toast.error("Password is required or enable Generate Password");
      return;
    }

    try {
      const created = await adminApi.createUser({
        email: createFormData.email,
        displayName: createFormData.fullName || createFormData.username,
        password: createFormData.password,
        role: createFormData.role,
        isActive: createFormData.status === "active",
      });
      setUsers((prev) => [
        {
          id: created.id,
          username: created.displayName || created.email,
          email: created.email,
          role: created.roleAdmin ? "admin" : created.roleCreator ? "creator" : "solver",
          status: created.isActive ? "active" : "suspended",
          createdAt: created.createdAt,
          lastActive: created.updatedAt,
        },
        ...prev,
      ]);
      toast.success(`User ${createFormData.username} created successfully`);
      setShowCreateDialog(false);
      setCreateFormData({
        fullName: "",
        email: "",
        username: "",
        role: "solver",
        password: "",
        status: "active",
        generatePassword: false,
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create user");
    }
  };

  const handleGeneratePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    const array = new Uint32Array(16);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      for (let i = 0; i < array.length; i++) array[i] = Math.floor(Math.random() * chars.length);
    }
    const randomPassword = Array.from(array, (x) => chars[x % chars.length]).join("");
    setCreateFormData({...createFormData, password: randomPassword, generatePassword: true});
    toast.success("Password generated");
  };

  const handleSuspendUser = async (user: User) => {
    if (!confirm(`Are you sure you want to suspend ${user.username}?`)) return;
    try {
      await adminApi.updateUser(user.id, { isActive: false });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: "suspended" } : u)));
      toast.success(`User ${user.username} suspended`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to suspend user");
    }
  };

  const handleDeleteUser = (_user: User) => {
    toast.error("Deletion is disabled; deactivate the user instead.");
  };

  const handleSendEmail = (user: User) => {
    toast.info(`Opening email to ${user.email}`);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Admin</Badge>;
      case "creator":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Creator</Badge>;
      case "solver":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Solver</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Pending</Badge>;
      case "suspended":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const formatLastActive = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cyber-border">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </CardContent>
        </Card>
        <Card className="cyber-border">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-400">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card className="cyber-border">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-400">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className="cyber-border">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-400">{stats.suspended}</div>
            <p className="text-xs text-muted-foreground">Suspended</p>
          </CardContent>
        </Card>
        <Card className="cyber-border">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.solvers}</div>
            <p className="text-xs text-muted-foreground">Solvers</p>
          </CardContent>
        </Card>
        <Card className="cyber-border">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.creators}</div>
            <p className="text-xs text-muted-foreground">Creators</p>
          </CardContent>
        </Card>
        <Card className="cyber-border">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.admins}</div>
            <p className="text-xs text-muted-foreground">Admins</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="cyber-border">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by username or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="solver">Solver</SelectItem>
                <SelectItem value="creator">Creator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="cyber-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                All user accounts are created and managed by administrators. There is no public registration.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                <UserPlus className="h-4 w-4" />
                Create User
              </Button>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>{getStatusBadge(user.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatLastActive(user.lastActive)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {user.role === "creator" && user.scenariosCreated !== undefined && (
                      <span className="text-muted-foreground">
                        {user.scenariosCreated} created
                      </span>
                    )}
                    {user.scenariosCompleted !== undefined && (
                      <span className="text-muted-foreground">
                        {user.scenariosCompleted} completed
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditUser(user)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSendEmail(user)}>
                          <Mail className="mr-2 h-4 w-4" />
                          Send Email
                        </DropdownMenuItem>
                        {user.status !== "suspended" && (
                          <DropdownMenuItem onClick={() => handleSuspendUser(user)}>
                            <Ban className="mr-2 h-4 w-4" />
                            Suspend User
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteUser(user)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Create a new user account. The user will receive login credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={createFormData.fullName}
                onChange={(e) => setCreateFormData({ ...createFormData, fullName: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={createFormData.email}
                onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={createFormData.username}
                onChange={(e) => setCreateFormData({ ...createFormData, username: e.target.value })}
                placeholder="johndoe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={createFormData.role} onValueChange={(value: any) => setCreateFormData({ ...createFormData, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solver">Solver</SelectItem>
                  <SelectItem value="creator">Creator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="flex gap-2">
                <Input
                  id="password"
                  type="text"
                  value={createFormData.password}
                  onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                  placeholder="Enter password or generate"
                  disabled={createFormData.generatePassword}
                />
                <Button type="button" variant="outline" onClick={handleGeneratePassword}>
                  Generate
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Min 8 characters. User can change this after first login.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={createFormData.status} onValueChange={(value: any) => setCreateFormData({ ...createFormData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser}>
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user role and status for {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editRole">Role</Label>
              <Select value={editFormData.role} onValueChange={(value: any) => setEditFormData({ ...editFormData, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solver">Solver</SelectItem>
                  <SelectItem value="creator">Creator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editStatus">Status</Label>
              <Select value={editFormData.status} onValueChange={(value: any) => setEditFormData({ ...editFormData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
