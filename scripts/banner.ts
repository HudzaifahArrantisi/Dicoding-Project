declare global {
  interface ImportMeta {
    main: boolean
  }
}

// ANSI color codes & truecolor gradients
const green = '\x1b[1;32m'
const rose1 = '\x1b[38;2;251;113;133m'
const rose2 = '\x1b[38;2;244;63;94m'
const rose3 = '\x1b[38;2;225;29;72m'
const rose4 = '\x1b[38;2;218;58;106m'
const rose5 = '\x1b[38;2;190;18;60m'
const rose6 = '\x1b[38;2;159;18;57m'

const emerald1 = '\x1b[38;2;74;222;128m'
const emerald2 = '\x1b[38;2;52;211;153m'
const teal1 = '\x1b[38;2;45;212;191m'
const cyan1 = '\x1b[38;2;34;211;238m'
const sky1 = '\x1b[38;2;56;189;248m'
const blue1 = '\x1b[38;2;96;165;250m'

const bold = '\x1b[1m'
const dim = '\x1b[2m'
const reset = '\x1b[0m'

const bannerLines = [
  // DAISUKI (Brand Rose Gradient)
  `${rose1}  ██████╗  █████╗ ██╗███████╗██╗   ██╗██╗  ██╗██╗`,
  `${rose2}  ██╔══██╗██╔══██╗██║██╔════╝██║   ██║██║ ██╔╝██║`,
  `${rose3}  ██║  ██║███████║██║███████╗██║   ██║█████╔╝ ██║`,
  `${rose4}  ██║  ██║██╔══██║██║╚════██║██║   ██║██╔═██╗ ██║`,
  `${rose5}  ██████╔╝██║  ██║██║███████║╚██████╔╝██║  ██╗██║`,
  `${rose6}  ╚═════╝ ╚═╝  ╚═╝╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝`,
  // SERVER (Emerald to Cyan Gradient)
  `${emerald1}  ███████╗███████╗██████╗ ██╗   ██╗███████╗██████╗ `,
  `${emerald2}  ██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗`,
  `${teal1}  ███████╗█████╗  ██████╔╝██║   ██║█████╗  ██████╔╝`,
  `${cyan1}  ╚════██║██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗`,
  `${sky1}  ███████║███████╗██║  ██║ ╚████╔╝ ███████╗██║  ██║`,
  `${blue1}  ╚══════╝╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝${reset}`,
]

export function printServerBanner() {
  console.log()
  console.log(bannerLines.join('\n'))
  console.log()
  console.log(`  ${green}●${reset} ${bold}SERVER STATUS${reset} : ${green}${bold}ONLINE${reset} ${dim}(Development Environment)${reset}`)
  console.log(`  ${cyan1}➜${reset} ${bold}Frontend Web${reset}  : ${cyan1}http://localhost:3000${reset}`)
  console.log(`  ${cyan1}➜${reset} ${bold}Backend API${reset}   : ${cyan1}http://localhost:3001${reset}`)
  console.log(`  ${dim}──────────────────────────────────────────────────────────${reset}\n`)
}

if (import.meta.main) {
  printServerBanner()
}
