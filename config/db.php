<?php
/**
 * Database connection (PDO / MySQL)
 * Update these four constants to match your local MySQL setup.
 */
define('DB_HOST', 'localhost');
define('DB_NAME', 'bakery_db');
define('DB_USER', 'root');
define('DB_PASS', '');

function db() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $pdo = new PDO(
                'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
                DB_USER,
                DB_PASS,
                array(
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                )
            );
        } catch (PDOException $e) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(array('error' => 'Database connection failed: ' . $e->getMessage()));
            exit;
        }
    }
    return $pdo;
}

function uuid4() {
    // Compatible with old PHP (<7.0) that lacks random_bytes().
    if (function_exists('random_bytes')) {
        $data = random_bytes(16);
    } else {
        $data = '';
        for ($i = 0; $i < 16; $i++) {
            $data .= chr(mt_rand(0, 255));
        }
    }
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}
