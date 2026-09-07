/**
 * Code Google Apps Script Maître pour Callnet.ma
 * Ce script transforme votre Google Sheet en Base de Données Centralisée pour la plateforme :
 * - Gestion complète des Utilisateurs, Rôles et Mots de passe
 * - Journal d'Audit et Logs de Sécurité (connexions, modifications, synchronisations)
 * - Centralisation des Commandes
 * - Paramètres système & Métadonnées
 */

export const MASTER_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * CALLNET.MA - BASE DE DONNÉES CENTRALE GOOGLE APPS SCRIPT (v4.0)
 * =========================================================================
 * Ce script transforme votre Google Sheet en Base de Données Sécurisée :
 * - Utilisateurs, Rôles, Affectations & Mots de passe
 * - Logs d'activités & Sécurité (Audit Trail)
 * - Base globale des Commandes
 * - Paramètres Système
 *
 * DÉPLOIEMENT :
 * 1. Ouvrez votre Google Sheet > Extensions > Apps Script
 * 2. Remplacez TOUT le code par ce fichier
 * 3. Cliquez sur Déployer > Nouveau déploiement
 * 4. Type : "Application Web"
 * 5. Exécuter en tant que : "Moi (votre adresse email)"
 * 6. Qui a accès : "Tout le monde" (Anyone)
 * 7. Copiez l'URL de l'application Web (se terminant par /exec) et collez-la dans Callnet Admin.
 * =========================================================================
 */

function doGet(e) {
  return handleRequest(e ? e.parameter : {});
}

function doPost(e) {
  var params = {};
  if (e && e.parameter) {
    for (var k in e.parameter) { params[k] = e.parameter[k]; }
  }
  if (e && e.postData && e.postData.contents) {
    try {
      var body = JSON.parse(e.postData.contents);
      for (var b in body) { params[b] = body[b]; }
    } catch(err) {}
  }
  return handleRequest(params);
}

function handleRequest(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var action = params.action || params.type || 'ping';

  try {
    // 1. PING / DIAGNOSTIC
    if (action === 'ping') {
      var sheets = ss.getSheets().map(function(s) { return s.getName(); });
      var usersSheet = ss.getSheetByName('Users');
      var logsSheet = ss.getSheetByName('Logs');
      var ordersSheet = ss.getSheetByName('Orders');
      var settingsSheet = ss.getSheetByName('Settings');

      var usersCount = usersSheet ? Math.max(0, usersSheet.getLastRow() - 1) : 0;
      var logsCount = logsSheet ? Math.max(0, logsSheet.getLastRow() - 1) : 0;
      var ordersCount = ordersSheet ? Math.max(0, ordersSheet.getLastRow() - 1) : 0;

      return jsonResponse({
        success: true,
        message: "Base de données Google Sheets connectée et opérationnelle",
        sheets: sheets,
        schema: {
          users: !!usersSheet,
          logs: !!logsSheet,
          orders: !!ordersSheet,
          settings: !!settingsSheet
        },
        counts: {
          users: usersCount,
          logs: logsCount,
          orders: ordersCount
        },
        timestamp: new Date().toISOString()
      });
    }

    // 2. INITIALISATION / RÉPARATION DU SCHÉMA
    if (action === 'initSchema' || action === 'init') {
      return initDatabaseSchema(ss);
    }

    // 3. UTILISATEURS (USERS & PASSWORDS)
    if (action === 'getUsers' || action === 'listUsers') {
      return getUsersData(ss);
    }

    if (action === 'saveUser' || action === 'createUser' || action === 'updateUser') {
      return saveUserData(ss, params);
    }

    if (action === 'deleteUser') {
      return deleteUserData(ss, params.id || params.userId);
    }

    // 4. LOGS & AUDIT TRAIL
    if (action === 'getLogs' || action === 'listLogs') {
      return getLogsData(ss, params.limit ? parseInt(params.limit) : 100);
    }

    if (action === 'appendLog' || action === 'log') {
      return appendLogData(ss, params);
    }

    // 5. COMMANDES CENTRALISÉES (ORDERS)
    if (action === 'getOrders' || action === 'orders') {
      return getOrdersData(ss, params.sheet || 'Orders');
    }

    if (action === 'updateStatus' || action === 'update' || action === 'updateRow') {
      var sName = params.sheet || 'Orders';
      var s = ss.getSheetByName(sName) || ss.getSheets()[0];
      if (!s) return jsonResponse({ success: false, error: "Feuille introuvable: " + sName });
      return handleStatusUpdate(s, params);
    }

    if (action === 'saveOrder' || action === 'updateOrder') {
      return saveOrderData(ss, params);
    }

    if (action === 'bulkSaveOrders') {
      return bulkSaveOrdersData(ss, params);
    }

    // 6. PARAMÈTRES (SETTINGS)
    if (action === 'getSettings') {
      return getSettingsData(ss);
    }

    if (action === 'saveSetting') {
      return saveSettingData(ss, params.key, params.value);
    }

    // 7. COMPATIBILITÉ BOUTIQUE SIMPLE
    if (action === 'sheets') {
      return jsonResponse(ss.getSheets().map(function(s) { return s.getName(); }));
    }

    if (action === 'columns') {
      var sName = params.sheet || 'Orders';
      var s = ss.getSheetByName(sName) || ss.getSheets()[0];
      if (!s) return jsonResponse([]);
      var lc = s.getLastColumn();
      if (lc === 0) return jsonResponse([]);
      var hr = s.getRange(1, 1, 1, lc).getValues()[0];
      return jsonResponse(hr.filter(Boolean));
    }

    return jsonResponse({ error: "Action inconnue: " + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString(), stack: err.stack });
  }
}

// Initialise les feuilles nécessaires avec leurs en-têtes et données par défaut
function initDatabaseSchema(ss) {
  var created = [];

  // Feuille Users
  var uSheet = ss.getSheetByName('Users');
  if (!uSheet) {
    uSheet = ss.insertSheet('Users');
    uSheet.getRange(1, 1, 1, 10).setValues([
      ['ID', 'Nom', 'Email', 'Mot de Passe', 'Role', 'Boutiques Assignees', 'Google Sheet URL', 'Feuille Selectionnee', 'Auto Sync', 'Date Creation']
    ]);
    formatHeaderRow(uSheet, 10);
    // Insérer l'administrateur par défaut
    uSheet.appendRow(['admin-init', 'Administrateur Principal', 'admin@callnet.ma', 'adminpass', 'Admin', '[]', '', '', 'false', new Date().toISOString()]);
    uSheet.appendRow(['agent-1', 'Agent Call Center', 'agent@callnet.ma', 'agentpass', 'Agent', '["store-1"]', '', '', 'false', new Date().toISOString()]);
    uSheet.appendRow(['store-1', 'Boutique E-commerce', 'store@callnet.ma', 'storepass', 'Client', '[]', '', '', 'false', new Date().toISOString()]);
    created.push('Users');
  }

  // Feuille Logs
  var lSheet = ss.getSheetByName('Logs');
  if (!lSheet) {
    lSheet = ss.insertSheet('Logs');
    lSheet.getRange(1, 1, 1, 7).setValues([
      ['ID', 'Date Heure', 'Utilisateur', 'Action', 'Categorie', 'Details', 'Statut']
    ]);
    formatHeaderRow(lSheet, 7);
    lSheet.appendRow(['log-init', new Date().toISOString(), 'system@callnet.ma', 'INIT_DATABASE', 'system', 'Base de données centralisée initialisée avec succès', 'success']);
    created.push('Logs');
  }

  // Feuille Orders
  var oSheet = ss.getSheetByName('Orders');
  if (!oSheet) {
    oSheet = ss.insertSheet('Orders');
    oSheet.getRange(1, 1, 1, 15).setValues([
      ['ID', 'Nom Client', 'Telephone', 'Produit', 'Quantite', 'Variante', 'Prix', 'Date', 'Statut', 'Adresse', 'Ville', 'Quartier', 'Remarque', 'ID Client', 'Archive']
    ]);
    formatHeaderRow(oSheet, 15);
    created.push('Orders');
  }

  // Feuille Settings
  var setSheet = ss.getSheetByName('Settings');
  if (!setSheet) {
    setSheet = ss.insertSheet('Settings');
    setSheet.getRange(1, 1, 1, 3).setValues([
      ['Cle', 'Valeur', 'Date Modification']
    ]);
    formatHeaderRow(setSheet, 3);
    setSheet.appendRow(['PLATFORM_NAME', 'Callnet.ma CRM', new Date().toISOString()]);
    setSheet.appendRow(['AUTO_SYNC_INTERVAL', '15', new Date().toISOString()]);
    created.push('Settings');
  }

  return jsonResponse({
    success: true,
    message: "Structure de la base de données vérifiée et initialisée",
    createdSheets: created
  });
}

function formatHeaderRow(sheet, cols) {
  var range = sheet.getRange(1, 1, 1, cols);
  range.setBackground('#1e293b');
  range.setFontColor('#ffffff');
  range.setFontWeight('bold');
  sheet.setFrozenRows(1);
}

// Récupération des utilisateurs
function getUsersData(ss) {
  var sheet = ss.getSheetByName('Users');
  if (!sheet) return jsonResponse({ success: false, error: "Feuille 'Users' introuvable." });

  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return jsonResponse({ success: true, users: [] });

  var headers = rows[0].map(function(h) { return String(h).trim().toLowerCase(); });
  var users = [];

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0] && !r[2]) continue; // ignorer lignes vides

    var id = String(r[0] || 'usr-' + i);
    var name = String(r[1] || '');
    var email = String(r[2] || '');
    var password = String(r[3] || '');
    var role = String(r[4] || 'Client');
    var assignedClientIds = [];
    try {
      if (r[5]) assignedClientIds = JSON.parse(r[5]);
    } catch(e) {
      if (r[5]) assignedClientIds = String(r[5]).split(',').map(function(s) { return s.trim(); });
    }

    var googleSheetUrl = String(r[6] || '');
    var selectedSheet = String(r[7] || '');
    var autoSync = r[8] === true || String(r[8]).toLowerCase() === 'true';

    users.push({
      id: id,
      name: name,
      email: email,
      password: password,
      role: role,
      assignedClientIds: assignedClientIds,
      googleSheetUrl: googleSheetUrl,
      selectedSheet: selectedSheet,
      autoSync: autoSync
    });
  }

  return jsonResponse({ success: true, users: users });
}

// Sauvegarde d'un utilisateur (création ou mise à jour)
function saveUserData(ss, u) {
  var sheet = ss.getSheetByName('Users');
  if (!sheet) {
    initDatabaseSchema(ss);
    sheet = ss.getSheetByName('Users');
  }

  var rows = sheet.getDataRange().getValues();
  var foundRow = -1;
  var userId = u.id || ('usr-' + new Date().getTime());
  var userEmail = (u.email || '').toLowerCase().trim();

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(userId) || (userEmail && String(rows[i][2]).toLowerCase().trim() === userEmail)) {
      foundRow = i + 1;
      break;
    }
  }

  var assignedStr = JSON.stringify(u.assignedClientIds || []);
  var password = u.password !== undefined ? u.password : (foundRow > 0 ? rows[foundRow-1][3] : 'defaultpass');
  var role = u.role || (foundRow > 0 ? rows[foundRow-1][4] : 'Client');
  var name = u.name || (foundRow > 0 ? rows[foundRow-1][1] : '');
  var email = u.email || (foundRow > 0 ? rows[foundRow-1][2] : '');
  var gUrl = u.googleSheetUrl !== undefined ? u.googleSheetUrl : (foundRow > 0 ? rows[foundRow-1][6] : '');
  var sSheet = u.selectedSheet !== undefined ? u.selectedSheet : (foundRow > 0 ? rows[foundRow-1][7] : '');
  var aSync = u.autoSync !== undefined ? String(u.autoSync) : (foundRow > 0 ? String(rows[foundRow-1][8]) : 'false');
  var dateStr = foundRow > 0 ? rows[foundRow-1][9] : new Date().toISOString();

  var rowValues = [userId, name, email, password, role, assignedStr, gUrl, sSheet, aSync, dateStr];

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return jsonResponse({ success: true, message: "Utilisateur enregistré", user: { id: userId, name: name, email: email, role: role } });
}

// Suppression d'un utilisateur
function deleteUserData(ss, userId) {
  var sheet = ss.getSheetByName('Users');
  if (!sheet) return jsonResponse({ success: false, error: "Feuille 'Users' introuvable." });

  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(userId) || String(rows[i][2]).toLowerCase() === String(userId).toLowerCase()) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true, message: "Utilisateur supprimé" });
    }
  }
  return jsonResponse({ success: false, message: "Utilisateur non trouvé" });
}

// Récupération des logs
function getLogsData(ss, limit) {
  var sheet = ss.getSheetByName('Logs');
  if (!sheet) return jsonResponse({ success: true, logs: [] });

  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return jsonResponse({ success: true, logs: [] });

  var logs = [];
  var max = Math.min(rows.length - 1, limit || 100);

  for (var i = rows.length - 1; i >= Math.max(1, rows.length - max); i--) {
    var r = rows[i];
    logs.push({
      id: String(r[0] || 'log-' + i),
      timestamp: String(r[1] || ''),
      userEmail: String(r[2] || ''),
      action: String(r[3] || ''),
      category: String(r[4] || 'system'),
      details: String(r[5] || ''),
      status: String(r[6] || 'success')
    });
  }

  return jsonResponse({ success: true, logs: logs });
}

// Ajout d'un log
function appendLogData(ss, l) {
  var sheet = ss.getSheetByName('Logs');
  if (!sheet) {
    initDatabaseSchema(ss);
    sheet = ss.getSheetByName('Logs');
  }

  var logId = l.id || ('log-' + new Date().getTime());
  var timestamp = l.timestamp || new Date().toISOString();
  var userEmail = l.userEmail || l.email || 'system@callnet.ma';
  var action = l.action || 'GENERAL_ACTION';
  var category = l.category || 'system';
  var details = l.details || '';
  var status = l.status || 'success';

  sheet.appendRow([logId, timestamp, userEmail, action, category, details, status]);
  return jsonResponse({ success: true, message: "Log enregistré" });
}

// Récupération des commandes
function getOrdersData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName || 'Orders');
  if (!sheet) return jsonResponse({ success: true, orders: [] });

  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return jsonResponse({ success: true, orders: [] });

  var orders = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0] && !r[1] && !r[2]) continue;

    orders.push({
      id: String(r[0] || ''),
      customerName: String(r[1] || ''),
      phone: String(r[2] || ''),
      product: String(r[3] || ''),
      quantity: Number(r[4] || 1),
      variant: String(r[5] || ''),
      price: Number(r[6] || 0),
      date: String(r[7] || ''),
      status: String(r[8] || 'en attend').toLowerCase(),
      address: String(r[9] || ''),
      city: String(r[10] || ''),
      district: String(r[11] || ''),
      note: String(r[12] || ''),
      clientId: String(r[13] || 'store-1'),
      archived: r[14] === true || String(r[14]).toLowerCase() === 'true',
      _rowIndex: i + 1
    });
  }

  return jsonResponse({ success: true, orders: orders });
}

// Sauvegarde ou mise à jour d'une commande
function saveOrderData(ss, o) {
  var sheetName = o.sheet || 'Orders';
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    initDatabaseSchema(ss);
    sheet = ss.getSheetByName('Orders');
  }

  var rows = sheet.getDataRange().getValues();
  var foundRow = -1;
  var orderId = String(o.id || o.code || '');

  if (o.rowIndex && parseInt(o.rowIndex) > 1 && parseInt(o.rowIndex) <= rows.length) {
    foundRow = parseInt(o.rowIndex);
  } else if (orderId) {
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === orderId.trim()) {
        foundRow = i + 1;
        break;
      }
    }
  }

  var rowVals = [
    orderId || ('CMD-' + new Date().getTime()),
    o.customerName || o.nom || (foundRow > 0 ? rows[foundRow-1][1] : ''),
    o.phone || o.telephone || (foundRow > 0 ? rows[foundRow-1][2] : ''),
    o.product || o.produit || (foundRow > 0 ? rows[foundRow-1][3] : ''),
    o.quantity || o.quantite || (foundRow > 0 ? rows[foundRow-1][4] : 1),
    o.variant || o.variante || (foundRow > 0 ? rows[foundRow-1][5] : ''),
    o.price || o.prix || (foundRow > 0 ? rows[foundRow-1][6] : 0),
    o.date || (foundRow > 0 ? rows[foundRow-1][7] : new Date().toISOString()),
    o.status || o.statut || (foundRow > 0 ? rows[foundRow-1][8] : 'en attend'),
    o.address || o.adresse || (foundRow > 0 ? rows[foundRow-1][9] : ''),
    o.city || o.ville || (foundRow > 0 ? rows[foundRow-1][10] : ''),
    o.district || o.quartier || (foundRow > 0 ? rows[foundRow-1][11] : ''),
    o.note || o.remarque || (foundRow > 0 ? rows[foundRow-1][12] : ''),
    o.clientId || (foundRow > 0 ? rows[foundRow-1][13] : 'store-1'),
    o.archived !== undefined ? o.archived : (foundRow > 0 ? rows[foundRow-1][14] : false)
  ];

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, rowVals.length).setValues([rowVals]);
  } else {
    sheet.appendRow(rowVals);
    foundRow = sheet.getLastRow();
  }

  return jsonResponse({ success: true, message: "Commande enregistrée", updatedRow: foundRow, id: rowVals[0] });
}

// Sauvegarde en masse des commandes
function bulkSaveOrdersData(ss, params) {
  var orders = params.orders || [];
  if (!Array.isArray(orders) || orders.length === 0) {
    return jsonResponse({ success: true, count: 0 });
  }

  for (var i = 0; i < orders.length; i++) {
    saveOrderData(ss, orders[i]);
  }

  return jsonResponse({ success: true, count: orders.length, message: orders.length + " commandes synchronisées" });
}

// Paramètres
function getSettingsData(ss) {
  var sheet = ss.getSheetByName('Settings');
  if (!sheet) return jsonResponse({ success: true, settings: {} });

  var rows = sheet.getDataRange().getValues();
  var settings = {};
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0]) settings[String(rows[i][0])] = rows[i][1];
  }
  return jsonResponse({ success: true, settings: settings });
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

function saveSettingData(ss, key, val) {
  var sheet = ss.getSheetByName('Settings');
  if (!sheet) {
    initDatabaseSchema(ss);
    sheet = ss.getSheetByName('Settings');
  }

  var rows = sheet.getDataRange().getValues();
  var foundRow = -1;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(key)) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow > 0) {
    sheet.getRange(foundRow, 2, 1, 2).setValues([[val, new Date().toISOString()]]);
  } else {
    sheet.appendRow([key, val, new Date().toISOString()]);
  }

  return jsonResponse({ success: true, message: "Paramètre sauvegardé" });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
