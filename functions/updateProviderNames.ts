import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const normalizeName = (name) => {
      if (!name) return '';
      return name.toLowerCase().trim().replace(/\s+/g, ' ');
    };

    const nameMap = {
      "EMI IMPO": "IMPO CBA",
      "GON CETSELL": "CELLSAT",
      "MATI": "MATI NEXUS",
      "MARTIN MB": "MB CELUS"
    };

    // Build normalized map: normalizedOldName -> newName
    const normalizedMap = {};
    for (const oldName in nameMap) {
      normalizedMap[normalizeName(oldName)] = { newName: nameMap[oldName], oldName };
    }

    const allVentas = await base44.asServiceRole.entities.Venta.list();
    const updatedVentas = [];

    for (const venta of allVentas) {
      const snapshot = venta.proveedorNombreSnapshot;
      if (!snapshot) continue;

      const normalized = normalizeName(snapshot);
      const match = normalizedMap[normalized];

      if (match && snapshot !== match.newName) {
        await base44.asServiceRole.entities.Venta.update(venta.id, {
          proveedorNombreSnapshot: match.newName
        });
        updatedVentas.push({ id: venta.id, oldName: snapshot, newName: match.newName });
      }
    }

    return Response.json({
      message: `Se actualizaron ${updatedVentas.length} ventas.`,
      details: updatedVentas
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});