"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Instance {
  id: string;
  name: string;
  url: string;
  username: string;
  isActive: boolean;
  createdAt: string;
  _count: { snapshots: number };
}

const emptyForm = { name: "", url: "", username: "", password: "" };

export default function InstancesPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchInstances = () => {
    fetch("/api/instances")
      .then((r) => r.json())
      .then(setInstances)
      .catch(console.error);
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  const openCreate = () => {
    setEditingInstance(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (inst: Instance) => {
    setEditingInstance(inst);
    setForm({
      name: inst.name,
      url: inst.url,
      username: inst.username,
      password: "", // Don't pre-fill password
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingInstance) {
        // Update existing
        const res = await fetch(`/api/instances/${editingInstance.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error("Failed to update instance");
      } else {
        // Create new
        const res = await fetch("/api/instances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error("Failed to create instance");
      }
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingInstance(null);
      fetchInstances();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this instance? This will not delete associated snapshots.")) {
      return;
    }
    setDeleting(id);
    try {
      const res = await fetch(`/api/instances/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete instance");
      fetchInstances();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(null);
    }
  };

  const isCreateMode = !editingInstance;
  const canSave = isCreateMode
    ? form.name && form.url && form.username && form.password
    : form.name && form.url && form.username;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">ServiceNow Instances</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingInstance(null);
            setForm(emptyForm);
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>Add Instance</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isCreateMode ? "Add ServiceNow Instance" : "Edit ServiceNow Instance"}
              </DialogTitle>
              <DialogDescription>
                {isCreateMode
                  ? "Enter the connection details for your ServiceNow instance."
                  : "Update the connection details. Leave password blank to keep the existing one."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  placeholder="e.g., Production"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Instance URL</label>
                <Input
                  placeholder="https://instance.service-now.com"
                  value={form.url}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, url: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Username</label>
                <Input
                  placeholder="admin"
                  value={form.username}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, username: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Password{!isCreateMode && " (leave blank to keep current)"}
                </label>
                <Input
                  type="password"
                  placeholder={isCreateMode ? "" : "••••••••"}
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                />
              </div>
              <Button
                onClick={handleSave}
                disabled={saving || !canSave}
                className="w-full"
              >
                {saving
                  ? "Saving..."
                  : isCreateMode
                    ? "Add Instance"
                    : "Update Instance"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {instances.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No instances configured yet. Add one to start ingesting schemas.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Snapshots</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.map((inst) => (
                <TableRow key={inst.id}>
                  <TableCell className="font-medium">{inst.name}</TableCell>
                  <TableCell className="font-mono text-sm">{inst.url}</TableCell>
                  <TableCell>{inst.username}</TableCell>
                  <TableCell>{inst._count.snapshots}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(inst)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(inst.id)}
                      disabled={deleting === inst.id}
                    >
                      {deleting === inst.id ? "Deleting..." : "Delete"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
