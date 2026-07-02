async function callApi(action, params = {}) {
    const apiUrl = state.settings.webAppUrl || sessionStorage.getItem('lgt_api_url');
    
    if (!apiUrl) {
        throw new Error('API URL not configured. Please set it in Settings.');
    }
    
    // Remove trailing slash if exists
    const cleanUrl = apiUrl.replace(/\/$/, '');
    
    const payload = {
        action: action,
        ...params
    };
    
    try {
        // Use fetch with proper CORS handling
        const response = await fetch(cleanUrl, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error('Response not JSON:', text);
            return { success: false, message: 'Invalid response from server: ' + text.substring(0, 100) };
        }
        
    } catch (error) {
        console.error('API call error:', error);
        
        // Try alternative approach with form data
        try {
            const formData = new URLSearchParams();
            formData.append('payload', JSON.stringify(payload));
            
            const response2 = await fetch(cleanUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString()
            });
            
            const text2 = await response2.text();
            try {
                return JSON.parse(text2);
            } catch (e) {
                return { success: false, message: 'Server error: ' + text2.substring(0, 100) };
            }
            
        } catch (error2) {
            console.error('Alternative call also failed:', error2);
            throw error;
        }
    }
}
