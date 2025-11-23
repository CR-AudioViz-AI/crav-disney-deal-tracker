import Link from 'next/link'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Copyright */}
          <div className="text-sm text-gray-600">
            © {currentYear} CR AudioViz AI, LLC. Personal use only.
          </div>

          {/* Links */}
          <div className="flex items-center space-x-6">
            <Link 
              href="/about" 
              className="text-sm text-gray-600 hover:text-disney-blue transition-colors"
            >
              About
            </Link>
            <Link 
              href="/privacy" 
              className="text-sm text-gray-600 hover:text-disney-blue transition-colors"
            >
              Privacy
            </Link>
            <a 
              href="https://github.com/crav-disney-deal-tracker" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-gray-600 hover:text-disney-blue transition-colors"
            >
              GitHub
            </a>
          </div>

          {/* Disclaimer */}
          <div className="text-xs text-gray-500 text-center md:text-right max-w-md">
            Not affiliated with Disney. All trademarks belong to their respective owners.
          </div>
        </div>
      </div>
    </footer>
  )
}
