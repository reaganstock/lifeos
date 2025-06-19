// Debug script to test category creation in Supabase
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://upkyravoehbslbywitar.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwa3lyYXZvZWhic2xieXdpdGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1NjI4MDgsImV4cCI6MjA2NDEzODgwOH0.4lVuvAZCWbZ3Uk1aBqlXPY84jctN8CVmi-8KzkAwqd8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testCategoryCreation() {
  console.log('Testing Supabase connection...');
  
  // Test connection
  try {
    const { data, error } = await supabase.from('categories').select('count').limit(1);
    if (error) {
      console.error('Connection error:', error);
      return;
    }
    console.log('✅ Supabase connection successful');
  } catch (err) {
    console.error('Connection failed:', err);
    return;
  }

  // Test authentication
  try {
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Current user:', user ? `${user.email} (${user.id})` : 'Not authenticated');
    
    if (!user) {
      console.log('❌ No authenticated user found');
      return;
    }

    // Test category creation
    const testCategory = {
      id: crypto.randomUUID(),
      name: 'Test Category',
      icon: '🧪',
      color: '#FF6B6B',
      priority: 5,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('Attempting to create category:', testCategory);

    const { data, error } = await supabase
      .from('categories')
      .insert([testCategory])
      .select()
      .single();

    if (error) {
      console.error('❌ Category creation error:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
    } else {
      console.log('✅ Category created successfully:', data);
      
      // Clean up - delete the test category
      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', testCategory.id);
        
      if (deleteError) {
        console.error('❌ Failed to clean up test category:', deleteError);
      } else {
        console.log('✅ Test category cleaned up');
      }
    }

  } catch (err) {
    console.error('❌ Test failed:', err);
  }
}

testCategoryCreation().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(err => {
  console.error('Test script error:', err);
  process.exit(1);
});