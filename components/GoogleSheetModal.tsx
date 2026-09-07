import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { GoogleSheetsIcon } from './icons/GoogleSheetsIcon';

interface GoogleSheetModalProps {
    onSave: (url: string) => void;
    onClose: () => void;
    currentUrl: string | null;
    onDisconnect: () => void;
}

const APP_SCRIPT_CODE = `
/**
 * Callnet.ma - Store Sync Script v3 (Synchronisation Totale Tous Champs)
 * Connecte votre feuille Google Sheets à la plateforme Callnet (Statuts, Nom, Téléphone, Adresse, Ville, Prix, Quantité, Note, Produit)
 *
 * Déploiement :
 * - Sélectionnez 'Déployer' -> 'Nouveau déploiement' (ou 'Gérer les déploiements' -> 'Créer une nouvelle version')
 * - Type : Application Web
 * - Exécuter en tant que : Moi (votre email)
 * - Qui a accès : Tout le monde (Anyone)
 * - Copiez l'URL de l'application Web.
 */

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var type = e.parameter.type || e.parameter.action;
  var sheetName = e.parameter.sheet;
  
  try {
    if (type === 'sheets') {
      return jsonResponse(ss.getSheets().map(function(s) { return s.getName(); }));
    }

    if (!sheetName) throw new Error("Nom de la feuille obligatoire.");

    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Feuille '" + sheetName + "' introuvable.");

    if (type === 'columns') {
      var lastColumn = sheet.getLastColumn();
      if (lastColumn === 0) return jsonResponse([]);
      var headerRow = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
      var headers = headerRow.filter(function(h) { 
          return typeof h === 'string' && String(h).trim() !== ''; 
      }).map(function(h) { 
          return String(h).trim(); 
      });
      return jsonResponse(headers);
    }
    
    if (type === 'orders') {
      var data = getSheetData(sheet);
      return jsonResponse(data);
    }

    if (type === 'updateStatus' || type === 'update' || type === 'updateOrder' || type === 'updateRow') {
      return handleStatusUpdate(sheet, e.parameter);
    }
    
    return jsonResponse({ error: "Type paramètre invalide." });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    var data = {};
    if (e.postData && e.postData.contents) {
      try { data = JSON.parse(e.postData.contents); } catch(err) {}
    }
    var params = {};
    if (e && e.parameter) {
      for (var k in e.parameter) { params[k] = e.parameter[k]; }
    }
    for (var d in data) { params[d] = data[d]; }

    var sheetName = params.sheet || (e && e.parameter && e.parameter.sheet);
    var action = params.action || params.type || (e && e.parameter && e.parameter.action);

    if (action === 'updateStatus' || action === 'update' || action === 'updateOrder' || action === 'updateRow' || !action) {
      if (!sheetName) throw new Error("Nom de la feuille obligatoire.");
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error("Feuille '" + sheetName + "' introuvable.");
      return handleStatusUpdate(sheet, params);
    }

    return jsonResponse({ message: "Succès" });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function handleStatusUpdate(sheet, params) {
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return jsonResponse({ error: "Feuille vide." });

  var rawHeaders = rows[0];

  function cleanStr(s) {
    if (!s) return "";
    return String(s).toLowerCase()
      .replace(/[éèêë]/g, 'e')
      .replace(/[àâä]/g, 'a')
      .replace(/[îï]/g, 'i')
      .replace(/[ôö]/g, 'o')
      .replace(/[ùûü]/g, 'u')
      .replace(/[^a-z0-9]/g, '');
  }

  var headers = rawHeaders.map(function(h) { return cleanStr(h); });

  function findColIndex(customHeader, keywords) {
    if (customHeader) {
      var normCustom = cleanStr(customHeader);
      if (normCustom) {
        for (var j = 0; j < headers.length; j++) {
          if (headers[j] === normCustom) return j;
        }
        for (var j2 = 0; j2 < headers.length; j2++) {
          if (headers[j2].indexOf(normCustom) !== -1 || normCustom.indexOf(headers[j2]) !== -1) return j2;
        }
      }
    }
    for (var w = 0; w < keywords.length; w++) {
      for (var k = 0; k < headers.length; k++) {
        if (headers[k] === keywords[w]) return k;
      }
    }
    for (var w2 = 0; w2 < keywords.length; w2++) {
      for (var k2 = 0; k2 < headers.length; k2++) {
        if (headers[k2].indexOf(keywords[w2]) !== -1 || keywords[w2].indexOf(headers[k2]) !== -1) return k2;
      }
    }
    return -1;
  }

  // Determine status value and whether it should clear the cell ("en cours de confirmation" -> empty cell)
  var rawStat = params.status !== undefined ? params.status : (params.statut !== undefined ? params.statut : (params.statusRaw !== undefined ? params.statusRaw : params.statutRaw));
  if (rawStat === undefined || rawStat === null) rawStat = '';
  var rawStatStr = String(rawStat).trim();
  var rawStatClean = cleanStr(rawStatStr);

  var isClearStatus = false;
  if (!rawStatStr || rawStatClean === 'enattend' || rawStatClean === 'enattente' || rawStatClean === 'encours' || rawStatClean === 'encoursdeconfirmation' || rawStatClean === 'encoursconfirmation' || rawStatClean === 'processing' || rawStatClean === 'pending') {
    isClearStatus = true;
  }

  var valStatus = isClearStatus ? '' : rawStatStr;

  function setSmartStatusValue(cell, valStat, isClear) {
    if (isClear || !valStat || String(valStat).trim() === '') {
      try {
        cell.clearContent();
        return;
      } catch (eClear) {
        try { cell.setValue(''); return; } catch(eC2) {}
      }
    }

    var sStr = String(valStat).trim();
    var sClean = cleanStr(sStr);

    // 1. Check Data Validation rule dropdown options FIRST to match exact allowed dropdown value
    try {
      var rule = cell.getDataValidation();
      if (rule) {
        var args = rule.getCriteriaValues();
        if (args && args.length > 0) {
          var allowedList = [];
          if (Array.isArray(args[0])) {
            allowedList = args[0];
          } else if (args[0] && typeof args[0].getValues === 'function') {
            var rVals = args[0].getValues();
            for (var r = 0; r < rVals.length; r++) {
              for (var c = 0; c < rVals[r].length; c++) {
                if (rVals[r][c]) allowedList.push(String(rVals[r][c]));
              }
            }
          }
          
          for (var a = 0; a < allowedList.length; a++) {
            var cleanAllowed = cleanStr(allowedList[a]);
            if (cleanAllowed === sClean || 
                (sClean.indexOf('annul') !== -1 && cleanAllowed.indexOf('annul') !== -1) || 
                (sClean.indexOf('confirm') !== -1 && cleanAllowed.indexOf('confirm') !== -1) || 
                (sClean.indexOf('expid') !== -1 && cleanAllowed.indexOf('expid') !== -1) ||
                (sClean.indexOf('report') !== -1 && cleanAllowed.indexOf('report') !== -1)) {
              cell.setValue(allowedList[a]);
              return;
            }
          }
        }
      }
    } catch (eValidation) {}

    // 2. Try direct setValue
    try {
      cell.setValue(sStr);
      return;
    } catch (e1) {}

    // 3. Try alternative representations based on category
    var alternatives = [];
    if (sClean.indexOf('annul') !== -1 || sClean.indexOf('cancel') !== -1 || sClean.indexOf('refus') !== -1 || sClean.indexOf('rejet') !== -1) {
      alternatives = ['Annulé', 'Annule', 'annulé', 'annule', 'ANNULE', 'ANNULÉ', 'Annulée', 'annulée', 'Canceled', 'Cancelled', 'Refusé', 'Refuse', 'Annuler'];
    } else if (sClean.indexOf('confirm') !== -1) {
      alternatives = ['Confirme', 'Confirmé', 'confirme', 'confirmé', 'CONFIRME', 'CONFIRMÉ', 'Confirmed'];
    } else if (sClean.indexOf('expid') !== -1 || sClean.indexOf('exped') !== -1 || sClean.indexOf('ship') !== -1 || sClean.indexOf('livr') !== -1) {
      alternatives = ['EXPIDER', 'Expédié', 'Expedie', 'expédié', 'expedie', 'Expedier', 'Shipped', 'Livré', 'Livre'];
    } else if (sClean.indexOf('report') !== -1 || sClean.indexOf('postpon') !== -1) {
      alternatives = ['Reportée', 'Reporte', 'Reporter', 'reportée', 'reporte', 'reporter', 'Postponed'];
    } else if (sClean.indexOf('pas') !== -1 || sClean.indexOf('rep') !== -1) {
      alternatives = [sStr, 'Pas de rep 1', 'Pas de rep 2', 'Pas de rep 3', 'Pas de rep 4', 'Pas de réponse', 'Injoignable 1', 'Injoignable'];
    } else if (sClean.indexOf('faux') !== -1 || sClean.indexOf('incorect') !== -1 || sClean.indexOf('incorrect') !== -1) {
      alternatives = ['Faux numéro', 'Faux numero', 'Numéro incorrect', 'Numero incorrect', 'Personne incorrecte'];
    }

    for (var alt = 0; alt < alternatives.length; alt++) {
      try {
        cell.setValue(alternatives[alt]);
        return;
      } catch (eAlt) {}
    }

    // 4. Fallback: Clear validation rule on cell if strict mode blocked it, then setValue
    try {
      cell.clearDataValidations();
      cell.setValue(sStr);
    } catch (e3) {
      cell.setValue(String(sStr));
    }
  }

  var statusColIdx = findColIndex(params.statusHeader || "statut", ["statut", "status", "etat", "confirmation", "validation", "situation", "etatcommande", "statutcommande", "resultat", "decision", "remarque", "statuts", "etat_cmd", "etat_commande"]);
  var idColIdx = findColIndex(params.idHeader || "id", ["id", "code", "ref", "reference", "commande", "order", "num", "no", "idcommande"]);
  var phoneColIdx = findColIndex(params.phoneHeader || "telephone", ["telephone", "phone", "tele", "tel", "gsm", "mobile", "num", "numero", "contact", "whatsapp", "teleclient"]);
  var nameColIdx = findColIndex(params.nameHeader || "nom", ["nom", "customer", "client", "prenom", "fullname", "destinataire", "name", "acheteur", "dest", "nomclient"]);
  var productColIdx = findColIndex(params.productHeader || "produit", ["produit", "product", "article", "designation", "item"]);
  var addressColIdx = findColIndex(params.addressHeader || "adresse", ["adresse", "address", "livraison", "quartier", "rue", "location", "dest"]);
  var cityColIdx = findColIndex(params.cityHeader || "ville", ["ville", "city", "destination", "gouvernorat", "wilaya", "region"]);
  var priceColIdx = findColIndex(params.priceHeader || "prix", ["prix", "price", "montant", "total", "valeur", "cod"]);
  var quantityColIdx = findColIndex(params.quantityHeader || "quantite", ["quantite", "qty", "qte", "nombre", "count"]);
  var noteColIdx = findColIndex(params.noteHeader || "remarque", ["note", "remarque", "observation", "commentaire", "rem", "obs", "comment"]);

  var valName = params.customerName || params.name || params.nom;
  var valPhone = params.phone || params.telephone || params.tele || params.gsm;
  var valProduct = params.product || params.produit || params.article;
  var valAddress = params.address || params.adresse;
  var valCity = params.city || params.ville;
  var valPrice = params.price !== undefined && params.price !== null ? String(params.price) : (params.prix !== undefined && params.prix !== null ? String(params.prix) : '');
  var valQuantity = params.quantity !== undefined && params.quantity !== null ? String(params.quantity) : (params.quantite !== undefined && params.quantite !== null ? String(params.quantite) : '');
  var valNote = params.note || params.remarque || params.observation;

  var targetRow = -1;

  // 1. Check explicit rowIndex passed
  if (params.rowIndex && !isNaN(params.rowIndex)) {
    var rIdx = parseInt(params.rowIndex, 10);
    if (rIdx >= 2 && rIdx <= rows.length) {
      targetRow = rIdx;
    }
  }

  // 2. Match by ID
  if (targetRow === -1 && params.id) {
    var pId = cleanStr(params.id);
    if (pId) {
      for (var i = 1; i < rows.length; i++) {
        if (idColIdx !== -1 && cleanStr(rows[i][idColIdx]) === pId) {
          targetRow = i + 1;
          break;
        }
        for (var c = 0; c < rows[i].length; c++) {
          if (cleanStr(rows[i][c]) === pId) {
            targetRow = i + 1;
            break;
          }
        }
        if (targetRow !== -1) break;
      }
    }
  }

  // 3. Match by Phone number (check both oldPhone and phone)
  if (targetRow === -1) {
    var phonesToTest = [];
    if (params.oldPhone) phonesToTest.push(String(params.oldPhone).replace(/\D/g, ''));
    if (valPhone) phonesToTest.push(String(valPhone).replace(/\D/g, ''));

    for (var i = 1; i < rows.length; i++) {
      for (var p = 0; p < phonesToTest.length; p++) {
        var paramPhone = phonesToTest[p];
        if (paramPhone.length >= 6) {
          if (phoneColIdx !== -1) {
            var rowPhone = String(rows[i][phoneColIdx]).replace(/\D/g, '');
            if (rowPhone.length >= 6 && (rowPhone === paramPhone || rowPhone.endsWith(paramPhone.slice(-8)) || paramPhone.endsWith(rowPhone.slice(-8)))) {
              targetRow = i + 1;
              break;
            }
          }
          for (var c = 0; c < rows[i].length; c++) {
            var cellPhone = String(rows[i][c]).replace(/\D/g, '');
            if (cellPhone.length >= 6 && (cellPhone === paramPhone || cellPhone.endsWith(paramPhone.slice(-8)) || paramPhone.endsWith(cellPhone.slice(-8)))) {
              targetRow = i + 1;
              break;
            }
          }
          if (targetRow !== -1) break;
        }
      }
      if (targetRow !== -1) break;
    }
  }

  // 4. Match by Customer Name (check both oldCustomerName and customerName)
  if (targetRow === -1) {
    var namesToTest = [];
    if (params.oldCustomerName) namesToTest.push(cleanStr(params.oldCustomerName));
    if (valName) namesToTest.push(cleanStr(valName));

    for (var i = 1; i < rows.length; i++) {
      for (var n = 0; n < namesToTest.length; n++) {
        var paramName = namesToTest[n];
        if (paramName.length >= 3) {
          if (nameColIdx !== -1) {
            var rowName = cleanStr(rows[i][nameColIdx]);
            if (rowName.length > 0 && (rowName === paramName || rowName.indexOf(paramName) !== -1 || paramName.indexOf(rowName) !== -1)) {
              targetRow = i + 1;
              break;
            }
          }
          for (var c = 0; c < rows[i].length; c++) {
            var cellName = cleanStr(rows[i][c]);
            if (cellName.length > 0 && (cellName === paramName || cellName.indexOf(paramName) !== -1 || paramName.indexOf(cellName) !== -1)) {
              targetRow = i + 1;
              break;
            }
          }
          if (targetRow !== -1) break;
        }
      }
      if (targetRow !== -1) break;
    }
  }

  if (targetRow !== -1) {
    if (statusColIdx !== -1) {
      setSmartStatusValue(sheet.getRange(targetRow, statusColIdx + 1), valStatus, isClearStatus);
    }
    if (nameColIdx !== -1 && valName !== undefined && valName !== null && String(valName).trim() !== '') {
      sheet.getRange(targetRow, nameColIdx + 1).setValue(valName);
    }
    if (phoneColIdx !== -1 && valPhone !== undefined && valPhone !== null && String(valPhone).trim() !== '') {
      sheet.getRange(targetRow, phoneColIdx + 1).setValue(valPhone);
    }
    if (productColIdx !== -1 && valProduct !== undefined && valProduct !== null && String(valProduct).trim() !== '') {
      sheet.getRange(targetRow, productColIdx + 1).setValue(valProduct);
    }
    if (addressColIdx !== -1 && valAddress !== undefined && valAddress !== null && String(valAddress).trim() !== '') {
      sheet.getRange(targetRow, addressColIdx + 1).setValue(valAddress);
    }
    if (cityColIdx !== -1 && valCity !== undefined && valCity !== null && String(valCity).trim() !== '') {
      sheet.getRange(targetRow, cityColIdx + 1).setValue(valCity);
    }
    if (priceColIdx !== -1 && valPrice !== undefined && valPrice !== null && String(valPrice).trim() !== '') {
      sheet.getRange(targetRow, priceColIdx + 1).setValue(valPrice);
    }
    if (quantityColIdx !== -1 && valQuantity !== undefined && valQuantity !== null && String(valQuantity).trim() !== '') {
      sheet.getRange(targetRow, quantityColIdx + 1).setValue(valQuantity);
    }
    if (noteColIdx !== -1 && valNote !== undefined && valNote !== null && String(valNote).trim() !== '') {
      sheet.getRange(targetRow, noteColIdx + 1).setValue(valNote);
    }

    // Comprehensive scan across ALL sheet columns to ensure no field is missed
    for (var col = 0; col < rawHeaders.length; col++) {
      var hClean = cleanStr(rawHeaders[col]);
      if (!hClean) continue;

      var colNum = col + 1;
      // Check direct param match by header name
      if (params[rawHeaders[col]] !== undefined && params[rawHeaders[col]] !== null && String(params[rawHeaders[col]]).trim() !== '') {
        if (col === statusColIdx) {
          setSmartStatusValue(sheet.getRange(targetRow, colNum), params[rawHeaders[col]], isClearStatus);
        } else {
          sheet.getRange(targetRow, colNum).setValue(params[rawHeaders[col]]);
        }
      } else if (params[hClean] !== undefined && params[hClean] !== null && String(params[hClean]).trim() !== '') {
        if (col === statusColIdx) {
          setSmartStatusValue(sheet.getRange(targetRow, colNum), params[hClean], isClearStatus);
        } else {
          sheet.getRange(targetRow, colNum).setValue(params[hClean]);
        }
      }
    }

    return jsonResponse({ success: true, updatedRow: targetRow, status: valStatus, isCleared: isClearStatus });
  }

  // Auto-append row if not found in the sheet
  var newRow = [];
  for (var col = 0; col < rawHeaders.length; col++) {
    var hClean = cleanStr(rawHeaders[col]);
    var colVal = "";
    if (params[rawHeaders[col]] !== undefined && params[rawHeaders[col]] !== null) colVal = params[rawHeaders[col]];
    else if (params[hClean] !== undefined && params[hClean] !== null) colVal = params[hClean];
    else if (col === statusColIdx) colVal = valStatus || "";
    else if (col === nameColIdx) colVal = valName || "";
    else if (col === phoneColIdx) colVal = valPhone || "";
    else if (col === productColIdx) colVal = valProduct || "";
    else if (col === addressColIdx) colVal = valAddress || "";
    else if (col === cityColIdx) colVal = valCity || "";
    else if (col === priceColIdx) colVal = valPrice || "";
    else if (col === quantityColIdx) colVal = valQuantity || "";
    else if (col === noteColIdx) colVal = valNote || "";
    else if (col === idColIdx) colVal = params.id || "";
    newRow.push(colVal);
  }
  sheet.appendRow(newRow);
  var appendedRow = sheet.getLastRow();
  return jsonResponse({ success: true, updatedRow: appendedRow, status: valStatus, appended: true, isCleared: isClearStatus });
}

function getSheetData(sheet) {
  var rows = sheet.getDataRange().getValues();
  if (rows.length < 1) return [];
  
  var headers = rows[0];
  var data = [];
  
  for (var i = 1; i < rows.length; i++) {
    var obj = {};
    var hasRealData = false;
    for (var j = 0; j < headers.length; j++) {
      var val = rows[i][j];
      if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{')) && val.endsWith('}')) {
        try { val = JSON.parse(val); } catch(e) {}
      }
      obj[headers[j]] = val;
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        var strVal = String(val).trim().toLowerCase();
        if (strVal !== 'inconnu' && strVal !== '0' && strVal !== '0.00' && strVal !== '0 mad') {
          hasRealData = true;
        }
      }
    }
    // Ne pas importer des commandes sans données !
    if (hasRealData) {
      obj["_rowIndex"] = i + 1;
      data.push(obj);
    }
  }
  return data;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

export const GoogleSheetModalContent: React.FC<{
    onSave: (url: string) => Promise<void> | void;
    onDisconnect: () => void;
    currentUrl: string | null;
    isEmbedded?: boolean;
    onClose?: () => void;
    isSaving?: boolean;
}> = ({ onSave, onDisconnect, currentUrl, isEmbedded, onClose, isSaving = false }) => {
    const { t } = useLanguage();
    const [url, setUrl] = useState(currentUrl || '');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [localSaving, setLocalSaving] = useState(false);

    // Synchronize local URL state with external prop if it changes
    // This is important when the parent component clears currentUrl after disconnect
    React.useEffect(() => {
        if (currentUrl !== undefined && currentUrl !== null) {
            setUrl(currentUrl);
        }
    }, [currentUrl]);

    const effectiveSaving = isSaving || localSaving;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        let trimmedUrl = url.trim();
        
        if (trimmedUrl.includes('?')) {
            trimmedUrl = trimmedUrl.split('?')[0];
        }
        
        if (trimmedUrl.includes('docs.google.com/spreadsheets')) {
            setError("ERREUR : Vous avez utilisé l'URL du fichier. Utilisez l'URL de déploiement (Web App).");
            return;
        }

        if (!trimmedUrl.includes('script.google.com/macros/s/') || !trimmedUrl.includes('/exec')) {
            setError("URL Invalide. Elle doit se terminer par /exec.");
            return;
        }

        setError('');
        setLocalSaving(true);
        try {
            await onSave(trimmedUrl);
            if (!isEmbedded && onClose) onClose();
        } catch (err: any) {
            setError(err?.message || "Erreur lors de l'enregistrement de l'URL Google Sheets.");
        } finally {
            setLocalSaving(false);
        }
    };

    const handleCopyCode = () => {
        navigator.clipboard.writeText(APP_SCRIPT_CODE.trim());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <form onSubmit={handleSubmit} noValidate className={isEmbedded ? 'space-y-6' : 'bg-base-200 border border-base-300 rounded-[4px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto'}>
             {!isEmbedded && (
                <div className="p-6 border-b border-base-300 flex justify-between items-center bg-base-100/50">
                    <div>
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-secondary block mb-1">
                            Google Integration
                        </span>
                        <h2 id="sheet-modal-title" className="font-syne font-extrabold text-xl text-text-primary uppercase tracking-tight">
                            {t('connectGoogleSheetTitle')}
                        </h2>
                    </div>
                    {onClose && (
                        <button type="button" onClick={onClose} aria-label="Close modal" className="p-2 rounded-[2px] hover:bg-base-300 text-text-secondary transition-colors font-mono text-xs">
                            ✕
                        </button>
                    )}
                </div>
            )}
            
            <div className={`${isEmbedded ? 'space-y-6' : 'p-6 space-y-6'}`}>
                {/* Alert Box */}
                <div className="border-l-4 border-rose-500 bg-rose-500/10 p-5 rounded-[2px] space-y-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-rose-400 font-bold block">
                        Critical Error Warning
                    </span>
                    <p className="font-mono text-xs text-text-primary font-bold leading-relaxed">
                        Google Sheets conserve l'ancienne version du script. Mettez à jour votre déploiement pour synchroniser tous les champs (adresse, nom, téléphone, ville, prix).
                    </p>
                    <ul className="font-mono text-[11px] list-disc pl-5 space-y-1 text-text-secondary">
                        <li>Collez le code v3 ci-dessous dans votre projet Google Apps Script.</li>
                        <li>Cliquez sur <strong>Déployer ➔ Gérer les déploiements</strong> ➔ ✏️ Modifier.</li>
                        <li>Dans le menu déroulant Version, sélectionnez <strong>"Nouvelle version"</strong>.</li>
                        <li>Cliquez sur Déployer et collez l'URL d'exécution ci-dessous.</li>
                    </ul>
                </div>

                {/* Script Code Block */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-secondary font-bold">
                            Script Source Code (v3)
                        </label>
                        <button
                            type="button"
                            onClick={handleCopyCode}
                            className="bg-accent/10 hover:bg-accent/20 text-accent font-mono text-[10px] font-bold px-3 py-1 rounded-[2px] transition-colors border border-accent/40 uppercase tracking-wider"
                        >
                            {copied ? "COPIÉ ✓" : "COPIER LE CODE"}
                        </button>
                    </div>
                    <pre className="bg-black/80 text-[#88ff88] p-4 rounded-[2px] overflow-x-auto text-xs font-mono border-l-4 border-accent max-h-44 custom-scrollbar select-all">
                        {APP_SCRIPT_CODE.trim()}
                    </pre>
                </div>
                
                {/* Endpoint URL Input */}
                <div className="space-y-2">
                    <label htmlFor="url" className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-secondary font-bold block">
                        URL d'exécution (G-Script Web App /exec)
                    </label>
                    <input 
                        type="url" 
                        name="url" 
                        id="url" 
                        value={url} 
                        onChange={(e) => setUrl(e.target.value)} 
                        required 
                        className="w-full p-3 border border-base-300 rounded-[4px] bg-base-100 text-text-primary focus:outline-none focus:border-accent font-mono text-xs transition-all placeholder:text-text-secondary/40"
                        placeholder="https://script.google.com/macros/s/AKfy.../exec"
                        disabled={effectiveSaving}
                    />
                    {error && (
                        <p className="font-mono text-xs text-rose-500 font-bold mt-1">
                            {error}
                        </p>
                    )}
                </div>
            </div>
            
            <div className={`${isEmbedded ? 'pt-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-base-300' : 'p-6 bg-base-100/50 flex justify-between items-center border-t border-base-300'}`}>
                <div>
                    {currentUrl && (
                        <button 
                            type="button" 
                            onClick={onDisconnect}
                            className="border border-rose-500/50 text-rose-500 hover:bg-rose-500/10 font-mono text-xs font-bold px-5 py-3 rounded-[4px] uppercase tracking-wider transition-colors"
                            disabled={effectiveSaving}
                        >
                            RÉSILIATION
                        </button>
                    )}
                </div>
                <div className="flex gap-3 w-full sm:w-auto justify-end">
                    {onClose && (
                        <button type="button" onClick={onClose} disabled={effectiveSaving} className="py-3 px-5 rounded-[4px] bg-base-300/60 hover:bg-base-300 text-text-primary font-mono text-xs font-bold uppercase tracking-wider transition-all">
                            {t('cancel')}
                        </button>
                    )}
                    <button 
                        type="submit" 
                        disabled={effectiveSaving}
                        className={`py-3 px-8 rounded-[4px] bg-accent text-[#111113] hover:brightness-110 font-mono text-xs font-bold uppercase tracking-wider shadow-lg shadow-accent/20 transition-all flex items-center gap-2 ${effectiveSaving ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        {effectiveSaving && <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                        {effectiveSaving ? "CONNEXION..." : "ENREGISTRER LA CONFIGURATION"}
                    </button>
                </div>
            </div>
        </form>
    );
}

const GoogleSheetModal: React.FC<GoogleSheetModalProps> = ({ onSave, onClose, currentUrl, onDisconnect }) => {
    // This modal is primarily for initial setup or explicit URL change, so it manages its own saving state internally.
    const [isSavingModal, setIsSavingModal] = useState(false);

    const handleInternalSave = async (url: string) => {
        setIsSavingModal(true);
        try {
            await onSave(url);
            // Parent's onSave will handle further state updates (like closing modal)
        } finally {
            setIsSavingModal(false);
        }
    }

    return (
        <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex justify-center items-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-modal-title"
        >
           <GoogleSheetModalContent 
               onSave={handleInternalSave} 
               onClose={onClose} 
               currentUrl={currentUrl} 
               onDisconnect={onDisconnect} 
               isSaving={isSavingModal} // Pass modal's internal saving state
           />
        </div>
    );
};

export default GoogleSheetModal;