Rails.application.routes.draw do
  get "/health", to: "health#index"
  get "/", to: "health#index"

  namespace :api do
    namespace :v1 do
      post "auth/signup", to: "auth#signup"
      post "auth/login", to: "auth#login"
      get "auth/me", to: "auth#me"
      post "ai/generate", to: "ai#generate"
    end
  end
end
