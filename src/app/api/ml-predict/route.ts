import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { execSync } from 'child_process';
import path from 'path';

// Check if Python is available
function findPythonCommand(): string | null {
  try {
    // Try python3 first (common on macOS/Linux)
    execSync('python3 --version', { stdio: 'ignore' });
    return 'python3';
  } catch {
    try {
      // Fallback to python
      execSync('python --version', { stdio: 'ignore' });
      return 'python';
    } catch {
      return null;
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const receiptData = await request.json();
    console.log('🤖 ML Prediction Request:', receiptData);

    // Check if Python is available
    const pythonCmd = findPythonCommand();
    if (!pythonCmd) {
      console.warn('⚠️ Python not found, using fallback ML analysis');
      const fallbackPrediction = {
        is_fraudulent: false,
        fraud_probability: 0.1,
        risk_level: 'LOW' as const,
        confidence: 0.5,
        error: 'Python ML model unavailable (Python not installed), using fallback analysis'
      };
      return NextResponse.json({ prediction: fallbackPrediction });
    }

    // Prepare data for Python ML model
    const mlInput = {
      items: receiptData.items || []
    };

    // Path to the ML directory and prediction script
    const mlDir = path.join(process.cwd(), 'ml');
    const predictScript = path.join(mlDir, 'predict_single.py');

    console.log(`🐍 Calling Python ML model using: ${pythonCmd}...`);

    // Call Python ML model via child process
    const pythonProcess = spawn(pythonCmd, [predictScript], {
      cwd: mlDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Send data to Python process
    pythonProcess.stdin.write(JSON.stringify(mlInput));
    pythonProcess.stdin.end();

    // Collect output from Python process
    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    // Wait for Python process to complete
    const result = await new Promise((resolve, reject) => {
      // Handle spawn errors (e.g., Python not found, script missing)
      pythonProcess.on('error', (error: any) => {
        console.warn('⚠️ Python process spawn error:', error.message);
        reject(error);
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const prediction = JSON.parse(output);
            console.log('✅ ML Prediction Result:', prediction);
            resolve(prediction);
          } catch (parseError) {
            console.error('❌ Failed to parse ML output:', parseError);
            reject(new Error('Failed to parse ML model output'));
          }
        } else {
          console.warn('⚠️ Python ML process failed:', errorOutput || 'Unknown error');
          reject(new Error(`ML model failed with code ${code}: ${errorOutput || 'Unknown error'}`));
        }
      });
    });

    return NextResponse.json({ prediction: result });

  } catch (error) {
    console.error('❌ ML Prediction Error:', error);
    
    // Fallback to basic analysis if ML model fails
    const fallbackPrediction = {
      is_fraudulent: false,
      fraud_probability: 0.1,
      risk_level: 'LOW' as const,
      confidence: 0.5,
      error: 'ML model unavailable, using fallback analysis'
    };

    return NextResponse.json({ prediction: fallbackPrediction });
  }
}
