"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AIModel {
  id: string;
  name: string;
  provider: "OPENAI" | "ANTHROPIC";
  baseUrl: string | null;
  modelId: string;
  isActive: boolean;
  createdAt: string;
}

const emptyForm = {
  name: "",
  provider: "OPENAI" as "OPENAI" | "ANTHROPIC",
  baseUrl: "",
  modelId: "",
  apiKey: "",
};

const MODEL_PLACEHOLDERS: Record<string, string> = {
  OPENAI: "e.g., gpt-4o, gpt-4o-mini",
  ANTHROPIC: "e.g., claude-sonnet-4-20250514",
};

export default function ModelsPage() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModel | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const fetchModels = () => {
    fetch("/api/models")
      .then((r) => r.json())
      .then(setModels)
      .catch(console.error);
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const resetDialog = () => {
    setEditingModel(null);
    setForm(emptyForm);
    setTestResult(null);
  };

  const openCreate = () => {
    resetDialog();
    setDialogOpen(true);
  };

  const openEdit = (model: AIModel) => {
    setEditingModel(model);
    setForm({
      name: model.name,
      provider: model.provider,
      baseUrl: model.baseUrl || "",
      modelId: model.modelId,
      apiKey: "",
    });
    setTestResult(null);
    setDialogOpen(true);
  };

  const handleTestConnection = async () => {
    if (!form.apiKey || !form.modelId) {
      setTestResult({
        success: false,
        message: "API key and model ID are required to test.",
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/models/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: form.provider,
          baseUrl: form.baseUrl || null,
          modelId: form.modelId,
          apiKey: form.apiKey,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, message: data.message });
      } else {
        setTestResult({ success: false, message: data.error });
      }
    } catch {
      setTestResult({
        success: false,
        message: "Failed to reach the test endpoint.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        provider: form.provider,
        baseUrl: form.baseUrl || null,
        modelId: form.modelId,
        apiKey: form.apiKey || undefined,
      };

      if (editingModel) {
        const res = await fetch(`/api/models/${editingModel.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update model");
      } else {
        const res = await fetch("/api/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create model");
      }
      setDialogOpen(false);
      resetDialog();
      fetchModels();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this AI model configuration?"
      )
    ) {
      return;
    }
    setDeleting(id);
    try {
      const res = await fetch(`/api/models/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete model");
      fetchModels();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(null);
    }
  };

  const isCreateMode = !editingModel;
  const canSave = isCreateMode
    ? form.name && form.provider && form.modelId && form.apiKey
    : form.name && form.provider && form.modelId;
  const canTest = form.apiKey && form.modelId;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">AI Models</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure AI model providers for definition drafting
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetDialog();
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openCreate}>Add Model</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isCreateMode
                  ? "Add AI Model"
                  : "Edit AI Model"}
              </DialogTitle>
              <DialogDescription>
                {isCreateMode
                  ? "Configure an AI model for generating field definitions."
                  : "Update the model configuration. Leave API key blank to keep the existing one."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  placeholder="e.g., GPT-4o, Claude Sonnet"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Provider</label>
                <Select
                  value={form.provider}
                  onValueChange={(value: "OPENAI" | "ANTHROPIC") =>
                    setForm((f) => ({ ...f, provider: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPENAI">OpenAI</SelectItem>
                    <SelectItem value="ANTHROPIC">Anthropic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">
                  Base URL{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </label>
                <Input
                  placeholder="Leave blank for default endpoint"
                  value={form.baseUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, baseUrl: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Override for Azure OpenAI, self-hosted, or proxy endpoints
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Model ID</label>
                <Input
                  placeholder={MODEL_PLACEHOLDERS[form.provider]}
                  value={form.modelId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, modelId: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  API Key
                  {!isCreateMode && " (leave blank to keep current)"}
                </label>
                <Input
                  type="password"
                  placeholder={isCreateMode ? "" : "••••••••"}
                  value={form.apiKey}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, apiKey: e.target.value }))
                  }
                />
              </div>

              {/* Test Connection */}
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testing || !canTest}
                  className="shrink-0"
                >
                  {testing ? "Testing..." : "Test Connection"}
                </Button>
                {testResult && (
                  <p
                    className={`text-sm ${
                      testResult.success
                        ? "text-green-600"
                        : "text-destructive"
                    }`}
                  >
                    {testResult.message}
                  </p>
                )}
              </div>

              <Button
                onClick={handleSave}
                disabled={saving || !canSave}
                className="w-full"
              >
                {saving
                  ? "Saving..."
                  : isCreateMode
                    ? "Add Model"
                    : "Update Model"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {models.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No AI models configured yet. Add one to enable AI-powered
            definition drafting.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Model ID</TableHead>
                <TableHead>Base URL</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((model) => (
                <TableRow key={model.id}>
                  <TableCell className="font-medium">{model.name}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        model.provider === "OPENAI"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                      }`}
                    >
                      {model.provider === "OPENAI" ? "OpenAI" : "Anthropic"}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {model.modelId}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {model.baseUrl || "Default"}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(model)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(model.id)}
                      disabled={deleting === model.id}
                    >
                      {deleting === model.id ? "Deleting..." : "Delete"}
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
