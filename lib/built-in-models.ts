// Встроенная коллекция 3D моделей из открытых источников
// Модели из Khronos Group glTF Sample Models (CC0/Public Domain)

export interface BuiltInModel {
  id: string
  name: string
  description?: string
  author?: string
  thumbnail?: string
  glbUrl: string
  categories?: string[]
}

export const builtInModels: BuiltInModel[] = [
  {
    id: "avocado",
    name: "Avocado",
    description: "A simple avocado model",
    author: "Microsoft",
    thumbnail: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Avocado/screenshot/screenshot.jpg",
    glbUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Avocado/glTF-Binary/Avocado.glb",
    categories: ["food"],
  },
  {
    id: "duck",
    name: "Duck",
    description: "Classic rubber duck",
    author: "Sony",
    thumbnail: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/screenshot/screenshot.jpg",
    glbUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb",
    categories: ["animal"],
  },
  {
    id: "cube",
    name: "Box",
    description: "Simple textured cube",
    author: "Cesium",
    thumbnail: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Box/screenshot/screenshot.png",
    glbUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Box/glTF-Binary/Box.glb",
    categories: ["primitive"],
  },
  {
    id: "brain-stem",
    name: "Brain Stem",
    description: "Anatomical brain stem model",
    author: "Keith Hunter",
    thumbnail: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/BrainStem/screenshot/screenshot.jpg",
    glbUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/BrainStem/glTF-Binary/BrainStem.glb",
    categories: ["anatomy"],
  },
  {
    id: "damaged-helmet",
    name: "Damaged Helmet",
    description: "Battle damaged sci-fi helmet",
    author: "theblueturtle_",
    thumbnail: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/DamagedHelmet/screenshot/screenshot.png",
    glbUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb",
    categories: ["object"],
  },
  {
    id: "lantern",
    name: "Lantern",
    description: "Old metal lantern",
    author: "UX3D",
    thumbnail: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Lantern/screenshot/screenshot.jpg",
    glbUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Lantern/glTF-Binary/Lantern.glb",
    categories: ["object"],
  },
  {
    id: "water-bottle",
    name: "Water Bottle",
    description: "Simple water bottle",
    author: "Mozi3D",
    thumbnail: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/WaterBottle/screenshot/screenshot.jpg",
    glbUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/WaterBottle/glTF-Binary/WaterBottle.glb",
    categories: ["object"],
  },
  {
    id: "flight-helmet",
    name: "Flight Helmet",
    description: "Detailed flight helmet",
    author: "Microsoft",
    thumbnail: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/FlightHelmet/screenshot/screenshot.jpg",
    glbUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/FlightHelmet/glTF/FlightHelmet.gltf",
    categories: ["object"],
  },
  {
    id: "buggy",
    name: "Buggy",
    description: "Off-road buggy vehicle",
    author: "Javier Ferretto",
    thumbnail: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Buggy/screenshot/screenshot.jpg",
    glbUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Buggy/glTF-Binary/Buggy.glb",
    categories: ["vehicle"],
  },
  {
    id: "sci-fi-helmet",
    name: "Sci-Fi Helmet",
    description: "Futuristic sci-fi helmet",
    author: "Michael Pavlovic",
    thumbnail: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/SciFiHelmet/screenshot/screenshot.jpg",
    glbUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/SciFiHelmet/glTF-Binary/SciFiHelmet.glb",
    categories: ["object"],
  },
]

export function searchBuiltInModels(query: string): BuiltInModel[] {
  if (!query.trim()) {
    return builtInModels
  }

  const lowerQuery = query.toLowerCase()
  return builtInModels.filter(
    (model) =>
      model.name.toLowerCase().includes(lowerQuery) ||
      model.description?.toLowerCase().includes(lowerQuery) ||
      model.categories?.some((cat) => cat.toLowerCase().includes(lowerQuery))
  )
}
