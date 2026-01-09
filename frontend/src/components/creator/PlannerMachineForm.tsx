import React from "react";
import { Input } from "../ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../ui/select";
import { Label } from "../ui/label";
import { toast } from "sonner";

const imageRefPattern = /^[A-Za-z0-9._/-]+(:[A-Za-z0-9._-]+)?$/;

export function PlannerMachineForm({ machine, onChange }: { machine: any; onChange: (m: any) => void }) {
  const validateImageRef = (ref: string) => {
    if (ref.includes("http://") || ref.includes("https://")) {
      toast.error("Do not prefix image with http/https");
      return false;
    }
    if (!imageRefPattern.test(ref)) {
      toast.error("Invalid image ref format");
      return false;
    }
    return true;
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Name</Label>
        <Input value={machine.name} onChange={(e) => onChange({ ...machine, name: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>Role</Label>
        <Select value={machine.role} onValueChange={(v) => onChange({ ...machine, role: v })}>
          <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="attacker">Attacker</SelectItem>
            <SelectItem value="internal">Internal</SelectItem>
            <SelectItem value="service">Service</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Image Ref</Label>
        <Input
          value={machine.imageRef}
          onChange={(e) => onChange({ ...machine, imageRef: e.target.value })}
          onBlur={(e) => validateImageRef(e.target.value)}
          placeholder="repo/name:tag"
        />
      </div>
      <div className="space-y-1">
        <Label>Resource Profile</Label>
        <Select value={machine.resourceProfile} onValueChange={(v) => onChange({ ...machine, resourceProfile: v })}>
          <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="micro">Micro</SelectItem>
            <SelectItem value="small">Small</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="large">Large</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Network Group</Label>
        <Input
          value={machine.networkGroup}
          onChange={(e) => onChange({ ...machine, networkGroup: e.target.value })}
          placeholder="net-A"
        />
      </div>
    </div>
  );
}
