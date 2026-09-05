window.SHIZUKU_ORDER_DATA = {
  brand: {
    name: "Shizuku Lab",
    handle: "@shizukulab.matcha",
    logo: "assets/logo-transparent.png",
    intro: "Small-batch matcha & houjicha, freshly whisked to order and crafted drop by drop.",
    collection: "Weekend pre-orders with self-collection in Toa Payoh.",
    background: "#f5f1e7",
    accent: "#68745e"
  },
  schedule: {
    label: "WEEKEND COLLECTION",
    day: "Saturday & Sunday",
    times: ["4:00 PM","4:30 PM","5:00 PM","5:30 PM","6:00 PM","6:30 PM","7:00 PM"]
  },
  options: {
    ice: ["Regular","Less Ice","No Ice"],
    sweetness: ["0%","25%","50%","75%","100%"],
    milk: ["Oat Milk","NOBO Soy Milk"]
  },
  products: [
    {category:"MATCHA",name:"Signature Matcha Latte",price:5.90,description:"Freshly whisked matcha with creamy oat milk.",image:"assets/matcha-latte.jpg",milk:true},
    {category:"MATCHA",name:"Ichigo Matcha Latte",price:6.90,description:"House-prepared strawberries with freshly whisked matcha.",image:"assets/ichigo-matcha.jpg",milk:true},
    {category:"HOUJICHA",name:"Signature Houjicha Latte",price:5.90,description:"Roasted houjicha with a soft, comforting finish.",image:"assets/houjicha-latte.jpg",milk:true},
    {category:"HOUJICHA",name:"Ichigo Houjicha Latte",price:6.90,description:"Roasted houjicha with house-prepared strawberries.",image:"assets/ichigo-houjicha.jpg",milk:true},
    {category:"SPECIAL",name:"Singapore Fog",price:6.90,description:"Teh-O meets freshly whisked creamy matcha.",image:"assets/singapore-fog.jpg",milk:false},
    {category:"SPECIAL",name:"Ma-Hou Latte",price:7.90,description:"Matcha latte with another whisked shot of houjicha.",image:"assets/mahou-latte.jpg",milk:true}
  ],
  promo: {code:"",discount:0}
};
