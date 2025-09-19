export function log(message: string){
    console.log(`[dusk-lattice]: ${message}`)
}

export function error(message: string, additional: any = ""){
    console.error(`[dusk-lattice]: ${message} ${additional}`)
}