import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pgClient from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function insertUserFromExcel(userData) {
    try {
        // Check if user already exists
        const existingUser = await pgClient.query(
            'SELECT id, first_name, last_name, phone_number, gender, preferred_gender, birth_date FROM users WHERE email = $1',
            [userData.email]
        );

        if (existingUser.rows.length > 0) {
            // User exists, update with new data from Excel (only if new data exists and old data is empty/null)
            const existing = existingUser.rows[0];
            const updates = [];
            const values = [];
            let valueIndex = 1;

            // Only update fields if Excel has data and existing field is empty/null
            if (userData.first_name && (!existing.first_name || existing.first_name.trim() === '')) {
                updates.push(`first_name = $${valueIndex++}`);
                values.push(userData.first_name);
            }
            
            if (userData.last_name && (!existing.last_name || existing.last_name.trim() === '')) {
                updates.push(`last_name = $${valueIndex++}`);
                values.push(userData.last_name);
            }
            
            if (userData.phone_number && !existing.phone_number) {
                updates.push(`phone_number = $${valueIndex++}`);
                values.push(userData.phone_number);
            }
            
            if (userData.gender && !existing.gender) {
                updates.push(`gender = $${valueIndex++}`);
                values.push(userData.gender);
            }
            
            if (userData.preferred_gender && !existing.preferred_gender) {
                updates.push(`preferred_gender = $${valueIndex++}`);
                values.push(userData.preferred_gender);
            }
            
            if (userData.birth_date && !existing.birth_date) {
                updates.push(`birth_date = $${valueIndex++}`);
                values.push(userData.birth_date);
            }

            if (updates.length > 0) {
                updates.push(`updated_at = $${valueIndex++}`);
                values.push(new Date());
                values.push(userData.email);

                await pgClient.query(
                    `UPDATE users SET ${updates.join(', ')} WHERE email = $${valueIndex}`,
                    values
                );
                console.log(`🔄 Updated user ${userData.email} with ${updates.length-1} new fields`);
            }

            return existing.id;
        }

        // User doesn't exist, insert new user
        const result = await pgClient.query(
            `INSERT INTO users (email, first_name, last_name, phone_number, gender, preferred_gender, birth_date, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id`,
            [
                userData.email,
                userData.first_name || '',
                userData.last_name || '',
                userData.phone_number || null,
                userData.gender || null,
                userData.preferred_gender || null,
                userData.birth_date || null,
                userData.created_at || new Date(),
                userData.updated_at || new Date()
            ]
        );

        console.log(`➕ Created new user ${userData.email}`);
        return result.rows[0].id;
    } catch (error) {
        console.error(`❌ Failed to insert/update Excel user ${userData.email}:`, error.message);
        throw error;
    }
}

async function insertAddress(userId, addressData) {
    try {
        if (!addressData.street && !addressData.city) {
            return; // Skip if no address data
        }

        await pgClient.query(
            `INSERT INTO addresses (user_id, street, house_number, postal_code, city, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                userId,
                addressData.street || null,
                addressData.house_number || null,
                addressData.postal_code || null,
                addressData.city || null,
                new Date()
            ]
        );
    } catch (error) {
        console.error(`❌ Failed to insert address for user ${userId}:`, error.message);
        throw error;
    }
}

async function insertHobby(userId, hobbyData) {
    try {
        if (!hobbyData.name) {
            return; // Skip if no hobby name
        }

        await pgClient.query(
            `INSERT INTO hobbies (user_id, name, rating, created_at)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, name) DO UPDATE 
               SET rating = EXCLUDED.rating`,
            [
                userId,
                hobbyData.name,
                hobbyData.rating || null,
                new Date()
            ]
        );
    } catch (error) {
        console.error(`❌ Failed to insert hobby for user ${userId}:`, error.message);
        throw error;
    }
}

function parseExcelDate(excelDate) {
    if (!excelDate) return null;
    
    // If it's already a date object
    if (excelDate instanceof Date) {
        return excelDate;
    }
    
    // If it's an Excel serial date number
    if (typeof excelDate === 'number') {
        // Excel serial date: days since January 1, 1900
        const excelEpoch = new Date(1900, 0, 1);
        const date = new Date(excelEpoch.getTime() + (excelDate - 1) * 24 * 60 * 60 * 1000);
        return date;
    }
    
    // Try to parse as string
    if (typeof excelDate === 'string') {
        const parsed = new Date(excelDate);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    
    return null;
}

function parseNameColumn(nameStr) {
    if (!nameStr) return { first_name: '', last_name: '' };
    
    // Format: "Nachname, Vorname"
    const parts = nameStr.split(',');
    if (parts.length === 2) {
        return {
            first_name: parts[1].trim(),
            last_name: parts[0].trim()
        };
    }
    
    // Fallback: treat whole string as last name
    return {
        first_name: '',
        last_name: nameStr.trim()
    };
}

function parseAddressColumn(addressStr) {
    if (!addressStr) return { street: '', house_number: '', postal_code: '', city: '' };
    
    // Format: "Straße Nr, PLZ Ort" 
    const parts = addressStr.split(',');
    if (parts.length !== 2) {
        return { street: addressStr.trim(), house_number: '', postal_code: '', city: '' };
    }
    
    const streetPart = parts[0].trim();
    const cityPart = parts[1].trim();
    
    // Extract street and house number from first part
    const streetMatch = streetPart.match(/^(.+?)\s+(\d+.*)$/);
    let street = '', house_number = '';
    if (streetMatch) {
        street = streetMatch[1].trim();
        house_number = streetMatch[2].trim();
    } else {
        street = streetPart;
    }
    
    // Extract postal code and city from second part
    const cityMatch = cityPart.match(/^(\d+)\s+(.+)$/);
    let postal_code = '', city = '';
    if (cityMatch) {
        postal_code = cityMatch[1];
        city = cityMatch[2].trim();
    } else {
        city = cityPart;
    }
    
    return { street, house_number, postal_code, city };
}

function parseHobbyColumn(hobbyStr) {
    if (!hobbyStr) return [];
    
    // Format: "Hobby1 %Prio1%; Hobby2 %Prio2%; ..."
    const hobbies = [];
    const hobbyParts = hobbyStr.split(';');
    
    for (const part of hobbyParts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        
        // Extract hobby name and rating
        const match = trimmed.match(/^(.+?)\s+%(\d+)%$/);
        if (match) {
            hobbies.push({
                name: match[1].trim(),
                rating: parseInt(match[2])
            });
        } else {
            // Just hobby name without rating
            hobbies.push({
                name: trimmed,
                rating: null
            });
        }
    }
    
    return hobbies;
}

function mapExcelRowToUser(row, headers) {
    const userData = {};
    
    // Map specific Excel headers to our fields
    const headerMappings = {
        'Nachname, Vorname': 'name',
        'Straße Nr, PLZ Ort': 'address', 
        'Telefon': 'phone_number',
        'E-Mail': 'email',
        'Geschlecht (m/w/nonbinary)': 'gender',
        'Interessiert an': 'preferred_gender',
        'Geburtsdatum': 'birth_date',
        'Hobby1 %Prio1%; Hobby2 %Prio2%; Hobby3 %Prio3%; Hobby4 %Prio4%; Hobby5 %Prio5%;': 'hobbies'
    };
    
    // Process each header
    for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        const value = row[i];
        
        if (!value || value === '') continue;
        
        if (header === 'Nachname, Vorname') {
            const names = parseNameColumn(value);
            userData.first_name = names.first_name;
            userData.last_name = names.last_name;
        }
        else if (header === 'Straße Nr, PLZ Ort') {
            const address = parseAddressColumn(value);
            userData.street = address.street;
            userData.house_number = address.house_number;
            userData.postal_code = address.postal_code;
            userData.city = address.city;
        }
        else if (header === 'Telefon') {
            userData.phone_number = value.toString().trim();
        }
        else if (header === 'E-Mail') {
            userData.email = value.toString().trim().toLowerCase();
        }
        else if (header === 'Geschlecht (m/w/nonbinary)') {
            const gender = value.toString().toLowerCase();
            if (gender === 'm' || gender === 'männlich') {
                userData.gender = 'male';
            } else if (gender === 'w' || gender === 'weiblich') {
                userData.gender = 'female';
            } else if (gender === 'nonbinary') {
                userData.gender = 'nonbinary';
            } else {
                userData.gender = gender;
            }
        }
        else if (header === 'Interessiert an') {
            const interest = value.toString().toLowerCase();
            if (interest === 'm' || interest === 'männlich') {
                userData.preferred_gender = 'male';
            } else if (interest === 'w' || interest === 'weiblich') {
                userData.preferred_gender = 'female';
            } else if (interest === 'alle' || interest === 'both') {
                userData.preferred_gender = 'both';
            } else {
                userData.preferred_gender = interest;
            }
        }
        else if (header === 'Geburtsdatum') {
            userData.birth_date = parseExcelDate(value);
        }
        else if (header.includes('Hobby')) {
            userData.hobbies = parseHobbyColumn(value);
        }
    }
    
    return userData;
}

async function importExcelData() {
    console.log('📊 Starting Excel import...');
    
    // Path to the Excel file
    const excelPath = join(__dirname, '../../Lets Meet DB Dump.xlsx');
    
    try {
        // Read the Excel file
        console.log(`📂 Reading Excel file: ${excelPath}`);
        const workbook = XLSX.readFile(excelPath);
        
        // Get the first worksheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        console.log(`📋 Processing worksheet: ${sheetName}`);
        
        // Convert to JSON
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (data.length === 0) {
            console.log('⚠️ No data found in Excel file');
            return;
        }
        
        // First row should be headers
        const headers = data[0];
        const rows = data.slice(1);
        
        console.log(`📊 Found ${rows.length} rows with headers:`, headers);
        
        let userCount = 0;
        let addressCount = 0;
        let hobbyCount = 0;
        
        // Process each row
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            // Skip empty rows
            if (!row || row.every(cell => !cell)) {
                continue;
            }
            
            try {
                const userData = mapExcelRowToUser(row, headers);
                
                // Must have email to create user
                if (!userData.email) {
                    console.log(`⚠️ Skipping row ${i + 2}: No email found`);
                    continue;
                }
                
                // Insert user
                const userId = await insertUserFromExcel(userData);
                userCount++;
                
                // Insert address if data exists
                if (userData.street || userData.city) {
                    await insertAddress(userId, {
                        street: userData.street,
                        house_number: userData.house_number,
                        postal_code: userData.postal_code,
                        city: userData.city
                    });
                    addressCount++;
                }
                
                // Insert ALL hobbies if data exists
                if (userData.hobbies && userData.hobbies.length > 0) {
                    for (const hobby of userData.hobbies) {
                        await insertHobby(userId, hobby);
                        hobbyCount++;
                    }
                }
                
                // Progress logging
                if (userCount % 50 === 0) {
                    console.log(`📊 Processed ${userCount} users from Excel`);
                }
                
            } catch (error) {
                console.error(`⚠️ Error processing row ${i + 2}:`, error.message);
                // Continue with next row
            }
        }
        
        console.log(`✅ Excel import completed:`);
        console.log(`   👥 Users: ${userCount}`);
        console.log(`   🏠 Addresses: ${addressCount}`);
        console.log(`   🎯 Hobbies: ${hobbyCount}`);
        
    } catch (error) {
        console.error('❌ Excel import failed:', error.message);
        throw error;
    }
}

// Export the function for use in index.js
export default importExcelData;

// Allow running this script directly
if (import.meta.url === `file://${process.argv[1]}`) {
    importExcelData()
        .then(() => {
            console.log('✅ Excel import completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Excel import failed:', error.message);
            process.exit(1);
        });
}