import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  
  if (action === 'state') {
    return NextResponse.json({
      status: 'ready',
      message: 'Javari AI system initialized',
      learningPhase: 'observation',
      accuracy: 0,
      patternsDiscovered: 0
    })
  }
  
  return NextResponse.json({
    message: 'Javari AI - Autonomous Disney Deal Assistant',
    status: 'mvp'
  })
}
