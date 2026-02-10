// Utilidades de normalización para importación de ventas

export function normalizeDate(dateString) {
  if (!dateString) return { value: null, error: "Fecha vacía" };
  
  const str = String(dateString).trim();
  
  // Intentar YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return { value: str, error: null };
    }
  }
  
  // Intentar DD/MM/YYYY (Argentina)
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    // Asumir DD/MM/YYYY para Argentina
    const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    if (!isNaN(date.getTime())) {
      return { 
        value: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
        error: null,
        warning: parseInt(day) > 12 ? null : "Formato ambiguo (asumido DD/MM/YYYY)"
      };
    }
  }
  
  return { value: str, error: "Formato de fecha inválido" };
}

export function normalizeNumber(numString) {
  if (!numString && numString !== 0) return { value: 0, error: null };
  
  let str = String(numString).trim();
  
  // Limpiar símbolos de moneda
  str = str.replace(/[$€US\s]/gi, '');
  
  // Manejar formatos: 1,400.50 o 1.400,50
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  
  if (hasComma && hasDot) {
    // Detectar cuál es el separador decimal (el último)
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      // Formato europeo: 1.400,50
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato americano: 1,400.50
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Solo coma: podría ser decimal o miles
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Probablemente decimal: 1400,50
      str = str.replace(',', '.');
    } else {
      // Miles: 1,400
      str = str.replace(/,/g, '');
    }
  }
  
  const num = parseFloat(str);
  
  if (isNaN(num)) {
    return { value: str, error: "No es un número válido" };
  }
  
  return { value: num, error: null };
}

export function normalizeMarketplace(marketString) {
  if (!marketString) return { value: "Otro", error: null };
  
  const str = String(marketString).toLowerCase().trim().replace(/\s+/g, '');
  
  const mapping = {
    'ml': 'MercadoLibre',
    'mercadolibre': 'MercadoLibre',
    'mercado libre': 'MercadoLibre',
    'ig': 'Instagram',
    'instagram': 'Instagram',
    'wa': 'WhatsApp',
    'whatsapp': 'WhatsApp',
    'local': 'Local',
    'tienda': 'Local'
  };
  
  const normalized = mapping[str] || mapping[marketString.toLowerCase().trim()] || "Otro";
  
  return { value: normalized, error: null };
}

export function normalizeProveedor(proveedorString) {
  if (!proveedorString) return { value: "", error: null };
  
  const str = String(proveedorString).trim().replace(/\s\s+/g, ' ');
  
  return { value: str, error: null };
}

export function extractProductDetails(modeloString, capacidadString, colorString) {
  let modelo = String(modeloString || "").trim();
  let capacidad = String(capacidadString || "").trim();
  let color = String(colorString || "").trim();
  
  // Si capacidad y color ya están, usar esos valores
  if (capacidad && color) {
    return { modelo, capacidad, color, error: null };
  }
  
  // Extraer capacidad del modelo si no está
  if (!capacidad && modelo) {
    const capacidadMatch = modelo.match(/\b(\d+)\s?(GB|TB)\b/i);
    if (capacidadMatch) {
      capacidad = capacidadMatch[1] + capacidadMatch[2].toUpperCase();
      modelo = modelo.replace(capacidadMatch[0], '').trim();
    }
  }
  
  // Extraer color del modelo si no está
  if (!color && modelo) {
    const coloresConocidos = [
      'Negro', 'Blanco', 'Azul', 'Rojo', 'Verde', 'Amarillo', 
      'Rosa', 'Morado', 'Gris', 'Oro', 'Plata', 'Titanio',
      'Grafito', 'Midnight', 'Starlight', 'Purple', 'Blue',
      'Black', 'White', 'Red', 'Green', 'Pink', 'Gold', 'Silver',
      'Natural', 'Desert', 'Alpine'
    ];
    
    for (const colorConocido of coloresConocidos) {
      const regex = new RegExp(`\\b${colorConocido}\\b`, 'i');
      if (regex.test(modelo)) {
        color = colorConocido;
        modelo = modelo.replace(regex, '').trim();
        break;
      }
    }
  }
  
  // Limpiar espacios múltiples
  modelo = modelo.replace(/\s\s+/g, ' ').trim();
  
  return { modelo, capacidad, color, error: null };
}

export function calculateGanancia(venta, costo, comision, canje = 0) {
  const v = typeof venta === 'number' ? venta : 0;
  const c = typeof costo === 'number' ? costo : 0;
  const com = typeof comision === 'number' ? comision : 0;
  const can = typeof canje === 'number' ? canje : 0;
  
  return v - c - com + can;
}

export function validateGanancia(gananciaImportada, gananciaCalculada, umbral = 0.01) {
  const diff = Math.abs(gananciaImportada - gananciaCalculada);
  
  if (diff > umbral) {
    return {
      valid: false,
      warning: `Ganancia importada (${gananciaImportada}) difiere de la calculada (${gananciaCalculada.toFixed(2)})`
    };
  }
  
  return { valid: true, warning: null };
}

export function normalizeRow(row, columnMapping) {
  const normalized = {};
  const errors = [];
  const warnings = [];
  
  // Mapear columnas
  for (const [fileColumn, ventaField] of Object.entries(columnMapping)) {
    if (ventaField === 'ignore' || !ventaField) continue;
    
    const value = row[fileColumn];
    
    switch (ventaField) {
      case 'fecha':
        const dateResult = normalizeDate(value);
        normalized.fecha = dateResult.value;
        if (dateResult.error) errors.push(`Fecha: ${dateResult.error}`);
        if (dateResult.warning) warnings.push(dateResult.warning);
        break;
        
      case 'costo':
      case 'comision':
      case 'venta':
        const numResult = normalizeNumber(value);
        normalized[ventaField] = numResult.value;
        if (numResult.error) errors.push(`${ventaField}: ${numResult.error}`);
        break;
        
      case 'marketplace':
        const marketResult = normalizeMarketplace(value);
        normalized.marketplace = marketResult.value;
        break;
        
      case 'proveedorTexto':
        const provResult = normalizeProveedor(value);
        normalized.proveedorTexto = provResult.value;
        break;
        
      default:
        normalized[ventaField] = value;
    }
  }
  
  // Extraer detalles de producto
  const productResult = extractProductDetails(
    normalized.modelo,
    normalized.capacidad,
    normalized.color
  );
  normalized.modelo = productResult.modelo;
  normalized.capacidad = productResult.capacidad;
  normalized.color = productResult.color;
  
  // Calcular ganancia si no existe
  if (!normalized.ganancia || normalized.ganancia === 0) {
    normalized.ganancia = calculateGanancia(
      normalized.venta,
      normalized.costo,
      normalized.comision,
      normalized.canje
    );
  } else {
    // Validar ganancia importada
    const calculada = calculateGanancia(
      normalized.venta,
      normalized.costo,
      normalized.comision,
      normalized.canje
    );
    const validation = validateGanancia(normalized.ganancia, calculada, 1);
    if (!validation.valid) {
      warnings.push(validation.warning);
    }
  }
  
  return {
    ...normalized,
    _errors: errors,
    _warnings: warnings,
    _hasErrors: errors.length > 0
  };
}