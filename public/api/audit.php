<?php
// ==============================================================================
// GestorMF API - Consulta de Trilha de Auditoria (Audit Logs)
// ==============================================================================
require_once __DIR__ . '/config.php';

$user = requireAuth(['ADMIN', 'MANAGER']);
$db = getDB();

$limit = isset($_GET['limit']) ? min((int)$_GET['limit'], 200) : 50;
$module = $_GET['module'] ?? '';
$search = $_GET['search'] ?? '';

$sql = "SELECT * FROM audit_logs WHERE 1=1";
$params = [];

if (!empty($module)) {
    $sql .= " AND module = ?";
    $params[] = strtoupper($module);
}

if (!empty($search)) {
    $sql .= " AND (user_name LIKE ? OR action LIKE ? OR details LIKE ?)";
    $like = "%{$search}%";
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}

$sql .= " ORDER BY created_at DESC LIMIT " . (int)$limit;

$stmt = $db->prepare($sql);
$stmt->execute($params);
$logs = $stmt->fetchAll();

jsonResponse([
    'success' => true,
    'count'   => count($logs),
    'logs'    => $logs
]);

