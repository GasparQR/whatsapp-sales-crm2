import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const nameMap = {
      "GON CETSELL": "CELLSAT",
      "EMI IMPO": "IMPO CBA",
      "MATI": "MATI NEXUS",
      "MARTIN MB": "MB CELUS",
      "MARTÍN MB": "MB CELUS",
      "MARTIN MB CELUS": "MB CELUS",
    };

    const allVentas = await base44.asServiceRole.entities.Venta.list('-created_date', 500);

    // Detectar cuáles necesitan actualización
    const toUpdate = [];
    for (const venta of allVentas) {
      const snap = (venta.proveedorNombreSnapshot || '').trim();
      const texto = (venta.proveedorTexto || '').trim();
      const newName = nameMap[snap];

      if (newName && snap !== newName) {
        toUpdate.push({ id: venta.id, codigo: venta.codigo, oldName: snap, newName });
      } else if (!snap && texto) {
        toUpdate.push({ id: venta.id, codigo: venta.codigo, oldName: '', newName: texto });
      }
    }

    // Actualizar de a 5 con pausa entre lotes
    const updated = [];
    const BATCH = 5;
    for (let i = 0; i < toUpdate.length; i += BATCH) {
      const batch = toUpdate.slice(i, i + BATCH);
      await Promise.all(batch.map(item =>
        base44.asServiceRole.entities.Venta.update(item.id, {
          proveedorNombreSnapshot: item.newName
        })
      ));
      updated.push(...batch);
      if (i + BATCH < toUpdate.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    return Response.json({
      message: `Se actualizaron ${updated.length} ventas.`,
      details: updated
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});