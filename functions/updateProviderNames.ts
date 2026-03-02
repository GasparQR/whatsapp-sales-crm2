import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // default true (diagnostico)

    // Mapeo: nombre incorrecto (exacto, case-insensitive trim) -> nombre correcto
    const nameMap = {
      "GON CETSELL": "CELLSAT",
      "EMI IMPO": "IMPO CBA",
      "MATI": "MATI NEXUS",
      "MARTIN MB": "MB CELUS",
      "MARTÍN MB": "MB CELUS",
      "MARTIN MB CELUS": "MB CELUS",
    };

    const allVentas = await base44.asServiceRole.entities.Venta.list();

    // Primero hacer diagnóstico: listar todos los valores únicos de proveedorNombreSnapshot
    const uniqueNames = {};
    for (const venta of allVentas) {
      const snap = venta.proveedorNombreSnapshot || venta.proveedorTexto || '';
      if (!uniqueNames[snap]) uniqueNames[snap] = 0;
      uniqueNames[snap]++;
    }

    if (dryRun) {
      return Response.json({
        mode: 'diagnostico',
        uniqueProveedorNames: uniqueNames,
        total: allVentas.length
      });
    }

    // Modo actualización: aplicar mapeo
    const updated = [];
    for (const venta of allVentas) {
      const snap = (venta.proveedorNombreSnapshot || '').trim();
      const snapUpper = snap.toUpperCase();

      let newName = null;
      for (const [oldName, correctedName] of Object.entries(nameMap)) {
        if (snapUpper === oldName.toUpperCase() && snap !== correctedName) {
          newName = correctedName;
          break;
        }
      }

      if (newName) {
        await base44.asServiceRole.entities.Venta.update(venta.id, {
          proveedorNombreSnapshot: newName
        });
        updated.push({ id: venta.id, oldName: snap, newName });
      }
    }

    return Response.json({
      mode: 'actualización',
      message: `Se actualizaron ${updated.length} ventas.`,
      details: updated
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});