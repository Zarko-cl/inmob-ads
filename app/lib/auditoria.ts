// Bitácora de auditoría (M9).
//
// Registra las acciones sensibles para poder reconstruir qué pasó ante un reclamo
// de un cliente, una fiscalización o una revisión de Meta. Se guarda el email del
// actor además de su id: si el usuario se borra, el registro sigue siendo legible.

import { prisma } from "@/lib/prisma";

export type AccionAuditada =
  | "CAMPANA_PUBLICADA"
  | "CAMPANA_ACTIVADA"
  | "CAMPANA_PAUSADA"
  | "CAMPANA_BORRADA"
  | "ESTRATEGIA_CREADA"
  | "ESTRATEGIA_BORRADA"
  | "META_CONECTADA"
  | "META_DESCONECTADA"
  | "CUMPLIMIENTO_BLOQUEO";

export async function registrarAuditoria(params: {
  organizationId: string;
  actor: { id: string; email: string } | null;
  action: AccionAuditada;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        actorUserId: params.actor?.id ?? null,
        actorEmail: params.actor?.email ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        metadataJson: (params.metadata as object) ?? undefined,
      },
    });
  } catch (err) {
    // La auditoría nunca debe hacer fallar la acción principal: es un registro
    // paralelo, no parte de la operación.
    console.error("No se pudo registrar en la bitácora de auditoría:", err);
  }
}
