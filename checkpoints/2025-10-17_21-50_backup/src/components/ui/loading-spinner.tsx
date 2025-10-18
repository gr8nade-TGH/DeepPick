import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-current border-t-transparent',
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}

export function LoadingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <LoadingSpinner size="xl" className="text-neon-green" />
        <p className="text-muted-foreground">Loading Deep Pick...</p>
      </div>
    </div>
  )
}

export function LoadingCard() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center space-y-2">
        <LoadingSpinner className="text-neon-green" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}
