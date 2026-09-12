import type { PrismaClient } from "@prisma/client";

export type WorkspaceReadRow = Record<string, unknown>;

export type WorkspaceRepository = {
  findTypedRows(resource: string, installationId: string): Promise<WorkspaceReadRow[]>;
};

export const createWorkspaceRepository = (prisma: PrismaClient): WorkspaceRepository => ({
  async findTypedRows(resource, installationId) {
    if (resource === "receipts") return (await prisma.receipt.findMany({ where: { installationId }, orderBy: { createdAt: "desc" } })) as unknown as WorkspaceReadRow[];
    if (resource === "picking") return (await prisma.pickingTask.findMany({ where: { installationId }, orderBy: { createdAt: "desc" } })) as unknown as WorkspaceReadRow[];
    if (resource === "shipments") return (await prisma.shipment.findMany({ where: { installationId }, orderBy: { createdAt: "desc" } })) as unknown as WorkspaceReadRow[];
    if (resource === "locations") return (await prisma.location.findMany({ where: { installationId }, orderBy: { code: "asc" } })) as unknown as WorkspaceReadRow[];
    if (resource === "inventory") return (await prisma.inventoryCount.findMany({ where: { installationId }, orderBy: { reference: "asc" } })) as unknown as WorkspaceReadRow[];
    if (resource === "replenishment") return (await prisma.replenishmentTask.findMany({ where: { installationId }, orderBy: { createdAt: "desc" } })) as unknown as WorkspaceReadRow[];
    if (resource === "products") return (await prisma.product.findMany({ where: { installationId }, orderBy: { sku: "asc" } })) as unknown as WorkspaceReadRow[];
    if (resource === "suppliers") return (await prisma.supplier.findMany({ where: { installationId }, orderBy: { code: "asc" } })) as unknown as WorkspaceReadRow[];
    if (resource === "customers") return (await prisma.customer.findMany({ where: { installationId }, orderBy: { code: "asc" } })) as unknown as WorkspaceReadRow[];
    if (resource === "integrations") return (await prisma.integration.findMany({ where: { installationId }, orderBy: { code: "asc" } })) as unknown as WorkspaceReadRow[];
    if (resource === "movements") return (await prisma.movementRecord.findMany({ where: { installationId }, orderBy: { createdAt: "desc" } })) as unknown as WorkspaceReadRow[];
    if (resource === "queries") return (await prisma.savedQuery.findMany({ where: { installationId }, orderBy: { code: "asc" } })) as unknown as WorkspaceReadRow[];
    if (resource === "users") {
      const installation = await prisma.installation.findUnique({ where: { id: installationId }, select: { clientId: true } });
      if (!installation) return [];
      return (await prisma.user.findMany({ where: { clientId: installation.clientId }, orderBy: { username: "asc" }, include: { assignments: { where: { installationId }, include: { role: true, installation: true } } } })) as unknown as WorkspaceReadRow[];
    }
    if (resource === "roles") return (await prisma.role.findMany({ orderBy: { key: "asc" }, include: { permissions: { include: { permission: true } } } })) as unknown as WorkspaceReadRow[];
    return [];
  },
});
