import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { api } from "../../services/api";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Field } from "./helpers";

export type WorkspaceUser = {id: number; name: string; email: string; role: string};

export function AccountDialog({user, open, onClose}: {user: WorkspaceUser; open: boolean; onClose: () => void}) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {if (open) {setCurrent(""); setPassword(""); setConfirmation(""); setMessage(""); setSaved(false);}}, [open]);

  async function save(event: React.FormEvent) {
    event.preventDefault(); setMessage(""); setSaved(false);
    if (password !== confirmation) {setMessage("A nova senha e a confirmação não batem."); return;}
    if (password.length < 6 || new TextEncoder().encode(password).length > 72) {setMessage("Use uma senha de pelo menos 6 caracteres e até 72 bytes."); return;}
    setSaving(true);
    try {
      await api.put(`/users/${user.id}/password`, {current_password: current, new_password: password});
      setSaved(true); setCurrent(""); setPassword(""); setConfirmation(""); setMessage("Senha atualizada.");
    } catch (error) {
      const detail = (error as {response?: {data?: {detail?: unknown}}}).response?.data?.detail;
      setMessage(typeof detail === "string" ? detail : "Não foi possível atualizar a senha. Tente novamente.");
    } finally {setSaving(false);}
  }
  return <Dialog open={open} onOpenChange={value => !value && !saving && onClose()}><DialogContent className="modal modal-settings">
    <DialogHeader><DialogTitle>Minha conta</DialogTitle><DialogDescription>{user.name} · {user.email}</DialogDescription></DialogHeader>
    <form onSubmit={event => void save(event)} className="account-form">
      <Field label="Senha atual"><input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} disabled={saving} required/></Field>
      <Field label="Nova senha"><input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} disabled={saving} minLength={6} required/></Field>
      <Field label="Confirmar nova senha"><input type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={saving} minLength={6} required/></Field>
      {message && <p role="status" className={`notice ${saved ? "" : "error"}`}>{message}</p>}
      <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Fechar</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="spin"/> : <Check/>}Alterar senha</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
