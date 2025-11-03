#!/usr/bin/env node

/**
 * Test script for 2FA API flow
 * Tests: status → toggle (enable) → generate → toggle (disable) → status
 * 
 * Usage: 
 *   node test-2fa-api.js <API_URL> <API_KEY> <USERNAME>
 * 
 * Example:
 *   node test-2fa-api.js https://em4.averox.com cd61775633b58a3f6c630d7a15e335f6 "@test:ms.beep.gov.pk"
 */

const API_URL = process.argv[2] || process.env.REACT_APP_2FA_URL || "https://em4.averox.com";
const API_KEY = process.argv[3] || process.env.REACT_APP_2FA_API_KEY || "cd61775633b58a3f6c630d7a15e335f6";
const USERNAME = process.argv[4] || "@test:ms.beep.gov.pk";

console.log("=".repeat(60));
console.log("2FA API Test Script");
console.log("=".repeat(60));
console.log(`API URL: ${API_URL}`);
console.log(`API Key: ${API_KEY.substring(0, 10)}...`);
console.log(`Username: ${USERNAME}`);
console.log("=".repeat(60));
console.log();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testEndpoint(name, method, endpoint, body = null) {
    console.log(`\n[TEST ${name}]`);
    console.log(`${method} ${endpoint}`);
    if (body) {
        console.log(`Body: ${JSON.stringify(body)}`);
    }
    
    try {
        const options = {
            method,
            headers: {
                "api-key": API_KEY,
                "Content-Type": "application/json",
            },
        };
        
        if (body) {
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(`${API_URL}${endpoint}`, options);
        const text = await response.text();
        
        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            data = { rawResponse: text };
        }
        
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log(`Response:`, JSON.stringify(data, null, 2));
        
        return { ok: response.ok, status: response.status, data };
    } catch (error) {
        console.error(`Error:`, error.message);
        return { ok: false, error: error.message };
    }
}

async function runTests() {
    console.log("\n🚀 Starting 2FA API Tests...\n");
    
    // Test 1: Check initial status
    console.log("\n" + "=".repeat(60));
    console.log("TEST 1: Check Initial Status");
    console.log("=".repeat(60));
    const status1 = await testEndpoint(
        "Status",
        "GET",
        `/2fa/status/${encodeURIComponent(USERNAME)}`
    );
    console.log(`\n✅ Initial Status Result:`);
    console.log(`   isEnabled: ${status1.data?.isEnabled ?? "N/A"}`);
    console.log(`   isConfigured: ${status1.data?.isConfigured ?? "N/A"}`);
    
    await delay(1000);
    
    // Test 2: Toggle ON (enable)
    console.log("\n" + "=".repeat(60));
    console.log("TEST 2: Toggle 2FA ON (Enable)");
    console.log("=".repeat(60));
    const toggleOn = await testEndpoint(
        "Toggle ON",
        "POST",
        "/2fa/toggle",
        { username: USERNAME, enabled: true }
    );
    console.log(`\n✅ Toggle ON Result:`);
    console.log(`   isEnabled: ${toggleOn.data?.isEnabled ?? "N/A"}`);
    console.log(`   isConfigured: ${toggleOn.data?.isConfigured ?? "N/A"}`);
    console.log(`   Message: ${toggleOn.data?.message ?? "N/A"}`);
    
    await delay(1000);
    
    // Test 3: Generate QR (should work if not configured)
    console.log("\n" + "=".repeat(60));
    console.log("TEST 3: Generate QR Code");
    console.log("=".repeat(60));
    const generate = await testEndpoint(
        "Generate",
        "POST",
        "/2fa/generate",
        { username: USERNAME }
    );
    console.log(`\n✅ Generate Result:`);
    console.log(`   Has QR: ${!!generate.data?.qr}`);
    console.log(`   Has Secret: ${!!generate.data?.secret}`);
    console.log(`   Message: ${generate.data?.message ?? "N/A"}`);
    if (generate.data?.qr) {
        console.log(`   QR URL length: ${generate.data.qr.length} chars`);
    }
    
    await delay(1000);
    
    // Test 4: Check status after generate
    console.log("\n" + "=".repeat(60));
    console.log("TEST 4: Check Status After Generate");
    console.log("=".repeat(60));
    const status2 = await testEndpoint(
        "Status After Generate",
        "GET",
        `/2fa/status/${encodeURIComponent(USERNAME)}`
    );
    console.log(`\n✅ Status After Generate:`);
    console.log(`   isEnabled: ${status2.data?.isEnabled ?? "N/A"}`);
    console.log(`   isConfigured: ${status2.data?.isConfigured ?? "N/A"}`);
    
    await delay(1000);
    
    // Test 5: Toggle OFF (disable) - if allowed
    console.log("\n" + "=".repeat(60));
    console.log("TEST 5: Toggle 2FA OFF (Disable)");
    console.log("=".repeat(60));
    const toggleOff = await testEndpoint(
        "Toggle OFF",
        "POST",
        "/2fa/toggle",
        { username: USERNAME, enabled: false }
    );
    console.log(`\n✅ Toggle OFF Result:`);
    console.log(`   isEnabled: ${toggleOff.data?.isEnabled ?? "N/A"}`);
    console.log(`   isConfigured: ${toggleOff.data?.isConfigured ?? "N/A"}`);
    console.log(`   Message: ${toggleOff.data?.message ?? toggleOff.data?.error ?? "N/A"}`);
    
    await delay(1000);
    
    // Test 6: Final status check
    console.log("\n" + "=".repeat(60));
    console.log("TEST 6: Final Status Check");
    console.log("=".repeat(60));
    const status3 = await testEndpoint(
        "Final Status",
        "GET",
        `/2fa/status/${encodeURIComponent(USERNAME)}`
    );
    console.log(`\n✅ Final Status Result:`);
    console.log(`   isEnabled: ${status3.data?.isEnabled ?? "N/A"}`);
    console.log(`   isConfigured: ${status3.data?.isConfigured ?? "N/A"}`);
    
    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 TEST SUMMARY");
    console.log("=".repeat(60));
    console.log("\nInitial Status:");
    console.log(`  isEnabled: ${status1.data?.isEnabled}`);
    console.log(`  isConfigured: ${status1.data?.isConfigured}`);
    
    console.log("\nAfter Toggle ON:");
    console.log(`  isEnabled: ${toggleOn.data?.isEnabled}`);
    console.log(`  isConfigured: ${toggleOn.data?.isConfigured}`);
    
    console.log("\nAfter Generate:");
    console.log(`  Status - isEnabled: ${status2.data?.isEnabled}`);
    console.log(`  Status - isConfigured: ${status2.data?.isConfigured}`);
    console.log(`  ⚠️  ISSUE: If isConfigured became true after generate, this is the bug!`);
    
    console.log("\nAfter Toggle OFF:");
    console.log(`  isEnabled: ${toggleOff.data?.isEnabled}`);
    console.log(`  isConfigured: ${toggleOff.data?.isConfigured}`);
    
    console.log("\nFinal Status:");
    console.log(`  isEnabled: ${status3.data?.isEnabled}`);
    console.log(`  isConfigured: ${status3.data?.isConfigured}`);
    
    console.log("\n" + "=".repeat(60));
    console.log("✅ Tests Complete!");
    console.log("=".repeat(60));
}

// Run tests
runTests().catch(error => {
    console.error("\n❌ Test execution failed:", error);
    process.exit(1);
});

